import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
    path: "/lemon-squeezy-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const payloadString = await request.text();
        const signature = request.headers.get("X-Signature");

        if (!signature) {
            return new Response("Missing X-Signature header", { status: 400 });
        }

        try {
            const payload = await ctx.runAction(internal.lemonSqueezy.verifyWebhook, {
                payload: payloadString,
                signature
            });

            if (payload.meta.event_name === "order_created") {
                const { data } = payload;

                const { success } =  await ctx.runMutation(api.users.upgradeToPro, {
                    email: data.attributes.user_email,
                    lemonSqueezyCustomerId: data.attributes.customer_id.toString(),
                    lemonSqueezyOrderId: data.id,
                    amount: data.attributes.total,
                });

                if (success) {
                    // do anything extra
                }
            }

            return new Response("Webhook processed successfully", { status: 200 });

        } catch (error) {
            console.log("Weebhook error: ", error);
            return new Response("Error processing webhook", { status: 500 });
        }
        
    })
})

http.route({
    path: "/clerk-webhook",
    method: "POST",

    handler: httpAction(async (ctx, request) => {
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
        }

        // collecting data about svix if webhook is present
        const svix_id = request.headers.get("svix-id");
        const svix_signature = request.headers.get("svix-signature");
        const svix_timestamp = request.headers.get("svix-timestamp");

        if (!svix_id || !svix_signature || !svix_timestamp) {
            throw new Response("Error occurred -- no svix headers", {
                status: 400,
            });
        }

        // if header present, getting the payload
        const payload = await request.json();
        const body = JSON.stringify(payload);

        const wh = new Webhook(webhookSecret);
        let evt: WebhookEvent;

        // verify
        try {
            evt = wh.verify(body, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }) as WebhookEvent
        } catch (err) {
            console.error("Error verifying webhook:", err);
            return new Response("Error occurred", { status: 400 });
        }

        // event type
        const eventType = evt.type;
        if (eventType === "user.created") {
            // save the user to convex db
            const { id, email_addresses, first_name, last_name} = evt.data;

            const email = email_addresses[0].email_address;
            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try {
                // save data to the database
                await ctx.runMutation(api.users.syncUser, {
                    userId: id,
                    email: email,
                    name: name,
                })
            } catch (err) {
                console.error("Error occurred in SAVING DATA TO THE DATABASE: ", err);
                return new Response("Error creatign user", { status: 500 });
            }
        }
        return new Response("Webhook processed successfully", { status : 200 });
    })
});

export default http;