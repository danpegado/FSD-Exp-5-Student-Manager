const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
	console.error(
		"Missing MongoDB URI. Add MONGODB_URI (or MONGO_URI) to your .env file."
	);
	process.exit(1);
}

mongoose
	.connect(mongoUri)
	.then(() => {
		console.log("✅ Connected to MongoDB Atlas");
	})
	.catch((error) => {
		console.error("MongoDB connection error:", error);
	});

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlength: 3,
		trim: true
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
		match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"]
	},
	age: {
		type: Number,
		min: 0,
		max: 120
	},
	hobbies: {
		type: [String],
		default: []
	},
	bio: {
		type: String,
		default: ""
	},
	userId: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	}
});

const User = mongoose.model("User", userSchema);

function normalizePayload(payload) {
	const normalized = { ...payload };

	if (typeof normalized.hobbies === "string") {
		normalized.hobbies = normalized.hobbies
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return normalized;
}

function handleApiError(error, res) {
	if (error instanceof mongoose.Error.CastError) {
		return res.status(400).json({ message: "Invalid ID format" });
	}

	if (error.code === 11000) {
		const duplicateField = Object.keys(error.keyPattern || {})[0] || "field";
		return res.status(400).json({ message: `${duplicateField} already exists` });
	}

	if (error.name === "ValidationError") {
		return res.status(400).json({
			message: "Validation failed",
			errors: Object.values(error.errors).map((item) => item.message)
		});
	}

	console.error(error);
	return res.status(500).json({ message: "Internal Server Error" });
}

app.get("/users", async (_req, res) => {
	try {
		const users = await User.find();
		return res.status(200).json(users);
	} catch (error) {
		return handleApiError(error, res);
	}
});

app.post("/addUser", async (req, res) => {
	try {
		const payload = normalizePayload(req.body);
		const user = new User(payload);
		const savedUser = await user.save();
		return res.status(201).json(savedUser);
	} catch (error) {
		return handleApiError(error, res);
	}
});

app.put("/updateUser/:id", async (req, res) => {
	try {
		const payload = normalizePayload(req.body);
		const updatedUser = await User.findByIdAndUpdate(req.params.id, payload, {
			new: true,
			runValidators: true
		});

		if (!updatedUser) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json(updatedUser);
	} catch (error) {
		return handleApiError(error, res);
	}
});

app.delete("/deleteUser/:id", async (req, res) => {
	try {
		const deletedUser = await User.findByIdAndDelete(req.params.id);

		if (!deletedUser) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json({ message: "User deleted successfully" });
	} catch (error) {
		return handleApiError(error, res);
	}
});

const PORT = process.env.PORT || 3000;

module.exports = app;
