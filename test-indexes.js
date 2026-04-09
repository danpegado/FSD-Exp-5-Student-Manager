const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
	console.error("MONGODB_URI is missing in .env");
	process.exit(1);
}

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

// Required lab indexes
userSchema.index({ name: 1 });
userSchema.index({ email: 1, age: -1 });
userSchema.index({ hobbies: 1 });
userSchema.index({ bio: "text" });
userSchema.index({ userId: "hashed" });
userSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

const User = mongoose.model("User", userSchema);

function logExplainStats(label, explainResult) {
	const stats = explainResult.executionStats || {};
	console.log(`\n[${label}]`);
	console.log(`totalDocsExamined: ${stats.totalDocsExamined ?? "n/a"}`);
	console.log(`totalKeysExamined: ${stats.totalKeysExamined ?? "n/a"}`);
}

async function run() {
	try {
		await mongoose.connect(mongoUri);
		console.log("Connected for index testing");

		await User.syncIndexes();
		console.log("Indexes synced successfully");

		const sampleUser = await User.findOne().lean();
		const sampleName = sampleUser?.name || "SampleName";
		const sampleEmail = sampleUser?.email || "sample@example.com";
		const sampleHobby = Array.isArray(sampleUser?.hobbies) && sampleUser.hobbies.length
			? sampleUser.hobbies[0]
			: "reading";

		// 1) Single index: { name: 1 }
		const singleExplain = await User.find({ name: sampleName }).explain("executionStats");
		logExplainStats("Single index (name)", singleExplain);

		// 2) Compound index: { email: 1, age: -1 }
		const compoundExplain = await User.find({ email: sampleEmail }).sort({ age: -1 }).explain("executionStats");
		logExplainStats("Compound index (email + age)", compoundExplain);

		// 3) Multikey index: { hobbies: 1 }
		const multikeyExplain = await User.find({ hobbies: sampleHobby }).explain("executionStats");
		logExplainStats("Multikey index (hobbies)", multikeyExplain);

		// 4) Text index: { bio: 'text' }
		const textExplain = await User.find({ $text: { $search: "student" } }).explain("executionStats");
		logExplainStats("Text index (bio)", textExplain);
	} catch (error) {
		console.error("Index test failed:", error);
	} finally {
		await mongoose.disconnect();
		console.log("Disconnected from MongoDB");
	}
}

run();
