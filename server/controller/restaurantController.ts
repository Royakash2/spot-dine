import type { Request, Response } from "express";

// get all restaurant with search and filter
export const getRestaurant = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};
export const getFeaturedRestaurant = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
   
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};
export const getRestaurantBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};
export const getRestaurantAvailabity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
   
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};
