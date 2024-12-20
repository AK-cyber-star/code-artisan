import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const syncUser = mutation({
    // handle arguments
    args: {
        userId: v.string(),
        email: v.string(),
        name: v.string(),
    },

    handler: async (ctx, args) => {
        // check for existing user
        const existingUser = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("userId"), args.userId))
            .first();

        // save to the DB if user not exist
        if (!existingUser) {
            await ctx.db.insert("users", {
                userId: args.userId,
                email: args.email,
                name: args.name,
                isPro: false,
            });
        }
    }
});

export const getUser = query({
    args: {
        userId: v.string(),
    },

    handler: async (ctx, args) => {
        if (!args.userId) return null;

        const user = await ctx.db
            .query("users")
            .withIndex("by_user_id")
            .filter((q) => q.eq(q.field("userId"), args.userId))
            .first();
        
        if (!user) return null;

        return user;
        
    }
});

export const upgradeToPro = mutation({
    args: {
        email: v.string(),
        lemonSqueezyCustomerId: v.string(),
        lemonSqueezyOrderId: v.string(),
        amount: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), args.email))
            .first();

        if (!user) throw new Error("User not found");

        await ctx.db.patch(user._id, {
            isPro: true,
            proSince: Date.now(),
            lemonSqueezyCustomerId: args.lemonSqueezyCustomerId,
            lemonSqueezyOrderId: args.lemonSqueezyOrderId,
        });

        return { success : true };
    }
})