import { Request, Response, NextFunction } from 'express';
import { checkAuth } from '../auth';
import { expressjwt } from 'express-jwt';

// Mock the express-jwt middleware
jest.mock('express-jwt', () => ({
  expressjwt: jest.fn().mockReturnValue(jest.fn()),
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

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
    (expressjwt as jest.Mock)().mockImplementation((req: Request, res: Response, next: NextFunction) => {
      next();
    });

    await checkAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should return 401 when authentication fails', async () => {
    // Mock failed authentication
    (expressjwt as jest.Mock)().mockImplementation((req: Request, res: Response, next: NextFunction) => {
      throw new Error('Invalid token');
    });

    await checkAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });
}); 