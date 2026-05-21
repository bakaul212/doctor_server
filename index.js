const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://docappoint-demo.web.app'],
    credentials: true,
  })
);

app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({
      message: 'Unauthorized access',
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ // ফ্রন্টএন্ডে টোকেন এক্সপায়ার হলে 401 পাঠানো স্ট্যান্ডার্ড যেন ইউজার অটো লগআউট হয়
        message: 'Unauthorized access',
      });
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();

    const db = client.db('docAppointDB');

    const doctorsCollection = db.collection('doctors');
    const appointmentsCollection = db.collection('appointments');
    const usersCollection = db.collection('users');

    // Demo Data Insert
    const doctorCount = await doctorsCollection.countDocuments();

    if (doctorCount === 0) {
      const demoDoctors = [
        {
          id: 'd1',
          name: 'Dr. Ayesha Rahman',
          specialty: 'Cardiologist',
          image:
            'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=400',
          experience: '10 years',
          availability: [
            '09:00 AM - 12:00 PM',
            '04:00 PM - 07:00 PM',
          ],
          description:
            'Highly experienced cardiologist specializing in heart diseases, preventive care, and patient-centered treatment.',
          hospital: 'Labaid Cardiac Hospital',
          location: 'Dhanmondi, Dhaka',
          fee: 800,
          rating: 5,
        },
        {
          id: 'd2',
          name: 'Dr. Asif Chowdhury',
          specialty: 'Neurologist',
          image:
            'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400',
          experience: '12 years',
          availability: [
            '10:00 AM - 01:00 PM',
            '06:00 PM - 09:00 PM',
          ],
          description:
            'Expert in neurological disorders, brain stroke management, and chronic migraine therapies.',
          hospital: 'Square Hospital',
          location: 'Panthapath, Dhaka',
          fee: 1000,
          rating: 4.9,
        },
        {
          id: 'd3',
          name: 'Dr. Sadiya Afrin',
          specialty: 'Pediatrician',
          image:
            'https://images.unsplash.com/photo-1594824813573-246434e33963?q=80&w=400',
          experience: '8 years',
          availability: ['11:00 AM - 03:00 PM'],
          description:
            'Dedicated pediatrician providing compassionate newborn care, vaccinations, and childhood nutrition guidance.',
          hospital: 'Evercare Hospital',
          location: 'Bashundhara, Dhaka',
          fee: 700,
          rating: 4.8,
        },
      ];

      await doctorsCollection.insertMany(demoDoctors);
      console.log('Demo doctors inserted');
    }

    // ==========================================
    // AUTHENTICATION APIs (ক্র্যাশ এবং 404 ফিক্স)
    // ==========================================

    // ১. ইউজার রেজিস্ট্রেশন (Fixes: 404 Not Found error)
    app.post('/api/auth/register', async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);

        if (existingUser) {
          return res.status(400).send({ message: 'User already exists with this email' });
        }

        const result = await usersCollection.insertOne(user);
        res.send({ success: true, message: 'Registration successful', userId: result.insertedId });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // ২. ইউজার লগইন এবং টোকেন জেনারেট
    app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const query = { email: email };
        const user = await usersCollection.findOne(query);

        // প্রোডাকশনে পাসওয়ার্ড অবশ্যই bcrypt দিয়ে হ্যাশ চেক করবেন। আপাতত সিম্পল চেক:
        if (!user || user.password !== password) {
          return res.status(401).send({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: '7d',
        });

        // পাসওয়ার্ড সিকিউরিটির জন্য ফ্রন্টএন্ডে পাঠানোর আগে রিমুভ করা ভালো
        const { password: _, ...userData } = user;
        res.send({ token, user: userData });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // ৩. গুগল লগইন এন্ডপয়েন্ট
    app.post('/api/auth/google', async (req, res) => {
      try {
        const { credential } = req.body;
        
        // ফ্রন্টএন্ড থেকে গুগল ক্রেড নিয়ে ব্যাকএন্ডে ডিকোড করার স্ট্যান্ডার্ড লজিক:
        const decoded = jwt.decode(credential); 
        if (!decoded) {
          return res.status(400).send({ message: 'Invalid Google Token' });
        }

        const googleUser = {
          name: decoded.name,
          email: decoded.email,
          photoURL: decoded.picture,
          role: 'patient'
        };

        const query = { email: googleUser.email };
        let user = await usersCollection.findOne(query);

        if (!user) {
          const result = await usersCollection.insertOne(googleUser);
          user = { _id: result.insertedId, ...googleUser };
        }

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: '7d',
        });

        res.send({ token, user });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // ৪. টোকেন ভেরিফিকেশন (Fixes: Page refresh logout issue)
    app.get('/api/auth/verify', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const user = await usersCollection.findOne({ email: email });

        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        const { password: _, ...userData } = user;
        res.send({ user: userData });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // ৫. প্রোফাইল আপডেট
    app.put('/api/users/profile', verifyToken, async (req, res) => {
      try {
        const { name, photoURL } = req.body;
        const email = req.decoded.email;

        const filter = { email: email };
        const updateDoc = {
          $set: { name, photoURL },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // legacy JWT API (প্রয়োজন হলে আগের ফর্মের জন্য রাখতে পারেন)
    app.post('/api/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      res.send({ token });
    });

    // =========================
    // Doctors APIs
    // =========================

    // Get All Doctors
    app.get('/api/doctors', async (req, res) => {
      try {
        const search = req.query.search || '';
        let query = {};

        if (search) {
          query = {
            name: { $regex: search, $options: 'i' },
          };
        }

        const result = await doctorsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Top Doctors
    app.get('/api/top-doctors', async (req, res) => {
      try {
        const result = await doctorsCollection
          .find()
          .sort({ rating: -1 })
          .limit(3)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Get Single Doctor
    app.get('/api/doctors/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { id: id };
        const result = await doctorsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // =========================
    // Appointment APIs
    // =========================

    // Create Appointment
    app.post('/api/appointments', verifyToken, async (req, res) => {
      try {
        const booking = req.body;
        const result = await appointmentsCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Get User Appointments
    app.get(
      '/api/appointments/my-appointments',
      verifyToken,
      async (req, res) => {
        try {
          const email = req.query.email;

          if (req.decoded.email !== email) {
            return res.status(403).send({
              message: 'Forbidden access',
            });
          }

          const query = { userEmail: email };
          const result = await appointmentsCollection.find(query).toArray();
          res.send(result);
        } catch (error) {
          res.status(500).send({ error: error.message });
        }
      }
    );

    // Get All Appointments
    app.get('/api/appointments', verifyToken, async (req, res) => {
      try {
        const result = await appointmentsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Update Appointment
    app.put('/api/appointments/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedBooking = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            patientName: updatedBooking.patientName,
            gender: updatedBooking.gender,
            phone: updatedBooking.phone,
            appointmentDate: updatedBooking.appointmentDate,
            appointmentTime: updatedBooking.appointmentTime,
          },
        };

        const result = await appointmentsCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Delete Appointment
    app.delete('/api/appointments/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await appointmentsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    console.log('Connected successfully to MongoDB!');
  } catch (error) {
    console.log(error);
  }
}

run().catch(console.dir);

// Root Route
app.get('/', (req, res) => {
  res.send('DocAppoint Server is Running smoothly...');
});

// Server Start
app.listen(port, () => {
  console.log(`Server is blasting off on port ${port}`);
});