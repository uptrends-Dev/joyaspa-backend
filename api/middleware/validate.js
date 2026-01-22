export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // TODO: Implement validation middleware
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
};
