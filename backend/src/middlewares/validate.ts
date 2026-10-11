import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Erro de validação',
          details: (error as any).errors.map((err: any) => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }
      return res.status(500).json({ error: 'Erro interno na validação' });
    }
  };
};
