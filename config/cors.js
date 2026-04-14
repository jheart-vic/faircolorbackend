import cors from "cors";

const corsOptions = {
  origin: [
    "http://localhost:5550",
    "http://localhost:4000",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:5001",
    "http://localhost:5002",
    "https://faircoloursmfb.vercel.app",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  exposedHeaders: ["Authorization", "refresh_token"],
};

export default cors(corsOptions);