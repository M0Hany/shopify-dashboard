"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAuth = exports.validateAuth0Token = void 0;
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const config_1 = require("../config");
const config = (0, config_1.getConfig)();
exports.validateAuth0Token = (0, express_jwt_1.expressjwt)({
    secret: jwks_rsa_1.default.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`
    }),
    audience: config.auth0.audience,
    issuer: `https://${config.auth0.domain}/`,
    algorithms: ['RS256']
});
const checkAuth = async (req, res, next) => {
    try {
        await (0, exports.validateAuth0Token)(req, res, next);
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ message: 'Unauthorized' });
    }
};
exports.checkAuth = checkAuth;
