import { Response } from 'express';
import { z } from 'zod';

/**
 * Einheitliches Error-Handling für API-Routes
 */
export function handleApiError(res: Response, error: any, defaultMessage: string = 'An error occurred') {
  console.error(defaultMessage, error);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      error: 'Invalid request data', 
      details: error.errors 
    });
  }
  
  const status = error.status || 500;
  const message = error.message || defaultMessage;
  
  res.status(status).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

/**
 * Wrapper für async Route-Handler mit Error-Handling
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleApiError(res, error);
    });
  };
}
