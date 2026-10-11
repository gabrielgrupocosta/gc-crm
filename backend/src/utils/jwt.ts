import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

export const generateToken = (userId: string, role: string) => {
  return jwt.sign({ id: userId, role }, SECRET, {
    expiresIn: '1d',
  });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, SECRET);
};
