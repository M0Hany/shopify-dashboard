"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const OrderSchema = new mongoose_1.Schema({
    shopifyId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    totalPrice: { type: String, required: true },
    financialStatus: { type: String, required: true },
    fulfillmentStatus: { type: String, required: true },
    tags: [{ type: String }],
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    lineItems: [{
            title: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: String, required: true },
        }],
    notes: [{ type: String }],
    status: { type: String, required: true, default: 'pending' },
}, {
    timestamps: true,
});
// Create index for faster queries
OrderSchema.index({ shopifyId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: 1 });
// Static method to create an order from Shopify data
OrderSchema.statics.createFromShopify = async function (shopifyOrder) {
    // Convert tags to array if it's a string or null
    const tags = Array.isArray(shopifyOrder.tags)
        ? shopifyOrder.tags
        : typeof shopifyOrder.tags === 'string'
            ? shopifyOrder.tags.split(',')
            : [];
    return this.create({
        shopifyId: shopifyOrder.id,
        name: shopifyOrder.name,
        email: shopifyOrder.email,
        phone: shopifyOrder.phone,
        totalPrice: shopifyOrder.total_price,
        financialStatus: shopifyOrder.financial_status,
        fulfillmentStatus: shopifyOrder.fulfillment_status,
        tags: tags,
        createdAt: new Date(shopifyOrder.created_at),
        updatedAt: new Date(shopifyOrder.updated_at),
        lineItems: shopifyOrder.line_items,
        status: tags.includes('express') ? 'express' : 'pending',
    });
};
exports.default = mongoose_1.default.model('Order', OrderSchema);
