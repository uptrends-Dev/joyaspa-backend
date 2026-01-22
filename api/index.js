import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Routes
import adminAuthRoutes from "./routes/admin.auth.routes.js";
import adminCategoriesRoutes from "./routes/admin.categories.routes.js";
import adminServicesRoutes from "./routes/admin.services.routes.js";
import adminPricingRoutes from "./routes/admin.pricing.routes.js";
import adminBookingsRoutes from "./routes/admin.bookings.routes.js";
import customerBrowseRoutes from "./routes/customer.browse.routes.js";
import customerBookingsRoutes from "./routes/customer.bookings.routes.js";
import branchesRoutes from "./routes/admin.branches.routes.js"
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";

// Errors
// import AppError from "./lib/AppError.js";
import globalErrorHandler from "./middleware/errorHandler.js";

const app = express();

const whitelist = ["http://localhost:3000", "https://www.joyaspa.net"];
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || whitelist.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan(":method :status - :response-time ms :url :res[content-length] "));

// Routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/categories", adminCategoriesRoutes);
app.use("/api/admin/services", adminServicesRoutes);
app.use("/api/admin/pricing", adminPricingRoutes);
app.use("/api/admin/branches", branchesRoutes );
app.use("/api/admin/bookings", adminBookingsRoutes);
app.use("/api/customer/browse", customerBrowseRoutes);
app.use("/api/customer/bookings", customerBookingsRoutes);

// Global error handler (لازم آخر حاجة)
app.use(globalErrorHandler);

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default app;
