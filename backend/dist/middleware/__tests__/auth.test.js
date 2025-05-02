"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../auth");
const express_jwt_1 = require("express-jwt");
// Mock the express-jwt middleware
jest.mock('express-jwt', () => ({
    expressjwt: jest.fn().mockReturnValue(jest.fn()),
}));
describe('Authentication Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        mockReq = {
            headers: {},
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should call next() when authentication is successful', async () => {
        // Mock successful authentication
        express_jwt_1.expressjwt().mockImplementation((req, res, next) => {
            next();
        });
        await (0, auth_1.checkAuth)(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
    });
    it('should return 401 when authentication fails', async () => {
        // Mock failed authentication
        express_jwt_1.expressjwt().mockImplementation((req, res, next) => {
            throw new Error('Invalid token');
        });
        await (0, auth_1.checkAuth)(mockReq, mockRes, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
});
