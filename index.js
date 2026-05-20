const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://docappoint-demo.web.app'], // আপনার ক্লায়েন্ট URL দিন
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
};

async function run() {
  try {
    // Connect to database
    // await client.connect(); // Production এ কমেন্ট আউট করে রাখতে পারেন ভেরসেলের জন্য
    const db = client.db("docAppointDB");
    const doctorsCollection = db.collection("doctors");
    const appointmentsCollection = db.collection("appointments");
    const usersCollection = db.collection("users");

    // --- Demo Data Setup (ডাটাবেজ খালি থাকলে লোড হবে) ---
    const count = await doctorsCollection.countDocuments();
    if(count === 0) {
        const demoDoctors = [
            {
              "id": "d1",
              "name": "Dr. Ayesha Rahman",
              "specialty": "Cardiologist",
              "image": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=400",
              "experience": "10 years",
              "availability": ["09:00 AM - 12:00 PM", "04:00 PM - 07:00 PM"],
              "description": "Highly experienced cardiologist specializing in heart diseases, preventive care, and patient-centered treatment.",
              "hospital": "Labaid Cardiac Hospital",
              "location": "Dhanmondi, Dhaka",
              "fee": 800,
              "rating": 5
            },
            {
              "id": "d2",
              "name": "Dr. Asif Chowdhury",
              "specialty": "Neurologist",
              "image": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400",
              "experience": "12 years",
              "availability": ["10:00 AM - 01:00 PM", "06:00 PM - 09:00 PM"],
              "description": "Expert in neurological disorders, brain stroke management, and chronic migraine therapies.",
              "hospital": "Square Hospital",
              "location": "Panthapath, Dhaka",
              "fee": 1000,
              "rating": 4.9
            },
            {
              "id": "d3",
              "name": "Dr. Sadiya Afrin",
              "specialty": "Pediatrician",
              "image": "https://images.unsplash.com/photo-1594824813573-246434e33963?q=80&w=400",
              "experience": "8 years",
              "availability": ["11:00 AM - 03:00 PM"],
              "description": "Dedicated pediatrician providing compassionate newborn care, vaccinations, and childhood nutrition guidance.",
              "hospital": "Evercare Hospital",
              "location": "Bashundhara, Dhaka",
              "fee": 700,
              "rating": 4.8
            }
        ];
        await doctorsCollection.insertMany(demoDoctors);
    }

    // --- Authentication JWT API ---
    app.post('/jwt', async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.send({ token });
    });

    // --- Doctors APIs ---
    // সব ডাক্তার এবং সার্চ ফিল্টার API
    app.get('/doctors', async (req, res) => {
        const search = req.query.search || '';
        let query = {};
        if (search) {
            query = { name: { $regex: search, $options: 'i' } };
        }
        const cursor = doctorsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    });

    // হোমপেজের ৩ জন টপ রেটেড ডাক্তার
    app.get('/top-doctors', async (req, res) => {
        const result = await doctorsCollection.find().limit(3).toArray();
        res.send(result);
    });

    // নির্দিষ্ট ডাক্তারের ডিটেইলস
    app.get('/doctors/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await doctorsCollection.findOne(query);
        res.send(result);
    });

    // --- Bookings / Appointments APIs ---
    // নতুন অ্যাপয়েন্টমেন্ট বুকিং
    app.post('/appointments', verifyToken, async (req, res) => {
        const booking = req.body;
        const result = await appointmentsCollection.insertOne(booking);
        res.send(result);
    });

    // লগইন থাকা নির্দিষ্ট ইউজারের সব বুকিং দেখা
    app.get('/my-appointments', verifyToken, async (req, res) => {
        const email = req.query.email;
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        const query = { userEmail: email };
        const result = await appointmentsCollection.find(query).toArray();
        res.send(result);
    });

    // অ্যাপয়েন্টমেন্ট আপডেট করা
    app.put('/appointments/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const updatedBooking = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                patientName: updatedBooking.patientName,
                gender: updatedBooking.gender,
                phone: updatedBooking.phone,
                appointmentDate: updatedBooking.appointmentDate,
                appointmentTime: updatedBooking.appointmentTime
            },
        };
        const result = await appointmentsCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    // অ্যাপয়েন্টমেন্ট ডিলিট করা
    app.delete('/appointments/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await appointmentsCollection.deleteOne(query);
        res.send(result);
    });

    console.log("Connected successfully to MongoDB!");
  } finally {
    // Keep connection alive
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('DocAppoint Server is Running smoothly...');
});

app.listen(port, () => {
    console.log(`Server is blasting off on port ${port}`);
});