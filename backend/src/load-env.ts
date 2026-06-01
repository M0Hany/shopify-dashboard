import dotenv from 'dotenv';
import path from 'path';

/** Load backend/.env before any service reads process.env (dev + dist). */
dotenv.config({ path: path.resolve(__dirname, '../.env') });
