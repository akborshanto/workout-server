const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 4000;
const jwt = require('jsonwebtoken')
const stripe = require('stripe')("sk_test_51PLSF52NHkygt9EvLzJWyOstCdquzjbXWNHrh0hCJLRWvEQGtkOJNHlaSSu2AutCcs5lF0aeT5pz84ZRNvTXxHxX00pu62gD6j");

require('dotenv').config()
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://workout-03.web.app'

    ],
    credentials: true
}));
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zqymdgy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const userCollection = client.db("workout").collection("users")
        const trainersCollection = client.db("workout").collection("trainers")
        const classesCollection = client.db("workout").collection("classes")
        const bookingCollection = client.db("workout").collection("booking")
        const paymentCollection = client.db("workout").collection("payments")
        const newsletterCollection = client.db("workout").collection("newsletters")
        const aplicationCollection = client.db("workout").collection("aplication")
        const forumCollection = client.db("workout").collection("forums")
        app.get('/', (req, res) => {
            res.send('Hello World!')
        })





        // middlewears ------------------------------------------
        const verifytoken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;

                next();
            })
        }


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        const verifyTrainer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isTrainer = user?.role === 'trainer';
            if (!isTrainer) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }







        // jwt related api------------------------------------------------
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // classes related api ------------------------------------------
        app.get('/classes', async (req, res) => {
            const search = req.query.search ? String(req.query.search) : '';
            console.log(search)

            const page = parseInt(req.query.page) || 1;
            const pageSize = 9;


            const skip = (page - 1) * pageSize;

            const result = await classesCollection.aggregate([
                {
                    $match: {
                        $or: [
                            { name: { $regex: search, $options: 'i' } },
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "trainers",
                        let: { className: "$name" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ["$$className", "$specialties"]
                                    }
                                }
                            },
                            {
                                $project: {
                                    id: "$_id",
                                    name: "$name",
                                    image: "$images"
                                }
                            }
                        ],
                        as: "trainers"
                    }
                },
                {
                    $project: {
                        name: 1,
                        title: 1,
                        description: 1,
                        image: 1,
                        bookings: 1,
                        trainers: 1
                    }
                },
                {
                    $sort: { bookings: -1 } // Sort by bookings in descending order
                },
                { $skip: skip },
                { $limit: pageSize }
            ]).toArray();

            res.send(result);

        });
        app.get('/classes/count', async (req, res) => {
            const result = await classesCollection.countDocuments()
            res.send({ result })
        })
        app.get('/classes/name', async (req, res) => {
            const classes = await classesCollection.find().toArray()
            const formattedClasses = classes.map(classItem => ({
                value: classItem.name,
                label: classItem.name
            }));
            res.send(formattedClasses)
        })
        app.post('/classes', async (req, res) => {
            const data = req.body
            const result = await classesCollection.insertOne(data)
            res.send(result)
        })





        // application for  tranier -----------------------------------------------------------------------
        app.post("/applictionBecameTrainer", async (req, res) => {
            const data = req.body
            const result = await aplicationCollection.insertOne(data)
            res.send(result)
        })
        app.get("/applictionBecameTrainer/:email", async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await aplicationCollection.findOne(query)
            res.send(result)
        })
        app.get("/applictionBecameTrainer", verifytoken, verifyAdmin, async (req, res) => {
            const result = await aplicationCollection.find().toArray()
            res.send(result)
        })


        app.get("/trainerData/:id", verifytoken, verifyAdmin, async (req, res) => {
            const id = req.params.id

            const quary = { _id: new ObjectId(id) }
            const result = await aplicationCollection.findOne(quary)
            res.send(result)
        })

        app.delete("/applictionBecameTrainer/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await aplicationCollection.deleteOne(query)
            res.send(result)
        })

        app.post("/applictionBecameTrainerUpdata", verifytoken, verifyAdmin, async (req, res) => {
            const data = req.body
            const email = req.body.email
            const quary = { email: email }
            const options = { upsert: true };
            if (data.statusdata === 'rejected') {

                const updatetedData = {
                    $set: {
                        status: data.statusdata,
                        massage: data.massage
                    }
                }
                const result = await aplicationCollection.updateOne(quary, updatetedData, options)
                res.send(result)
            }
            if (data.statusdata === 'approved') {
                const updatetedData = {
                    $set: {
                        status: data.statusdata
                    }
                }
                const updatetedRole = {
                    $set: {
                        role: "trainer"
                    }
                }
                const { _id, ...dataWithoutId } = data;

                const result = await aplicationCollection.updateOne(quary, updatetedData, options)
                const result1 = await trainersCollection.insertOne(dataWithoutId)
                const result2 = await userCollection.updateOne(quary, updatetedRole, options)
                res.send({ result, result1, result2 })
            }
        })


        // user related post api------------------------------------ ----------------------------------
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        app.get("/userCount", verifytoken, verifyAdmin, async (req, res) => {
            const result = await userCollection.countDocuments();
            res.send({ count: result });
        })












        // trainer related api -----------------------------------------------------------------
        app.get('/trainers', async (req, res) => {
            const result = await trainersCollection.find().toArray()
            res.send(result)
        })
        app.get('/trainers/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await trainersCollection.findOne(query)
            res.send(result)
        })
        app.get("/trainers", verifytoken, verifyAdmin, async (req, res) => {
            const result = await trainersCollection.find().toArray()
            res.send(result)
        })
        app.get("/bookedTrainer/:email", async (req, res) => {
            const result = await paymentCollection.find({ email: req.params.email }).toArray()
            res.send(result)
        })
        app.get('/trainerIndividualData/:email', verifytoken, verifyTrainer, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await trainersCollection.findOne(query)
            res.send(result)
        })
        app.delete("/trainerDelete/:email", async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const options = { upsert: true };
            const updatetedRole = {
                $set: {
                    role: "",
                }
            }
            const result2 = await userCollection.updateOne(query, updatetedRole, options)
            const result = await trainersCollection.deleteOne(query)
            res.send(result)
        })















        // bookings related api _____-----------------------------------------------------------------

        app.post("/booking", async (req, res) => {
            const data = req.body
            const result = await bookingCollection.insertOne(data)
            res.send(result)
        })
        app.get("/booking", async (req, res) => {
            const result = await bookingCollection.find().toArray()
            res.send(result)
        })


        app.get('/booking/:email', async (req, res) => {
            const email = req.params.email
            const query = { "user.email": email }
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })
        app.post("/bookedEmail", verifytoken, verifyTrainer, async (req, res) => {
            const name = req.body.name
            const trainerName = req.body.trainerName

            const quary = { soltName: name, trainerName: trainerName }
            const result = await paymentCollection.find(quary).toArray()
            res.send(result)
        })
        app.post("/sloteDelete", verifytoken, verifyTrainer, async (req, res) => {
            const name = req.body.name
            const trainerName = req.body.trainerName

            const quary = { soltName: name, trainerName: trainerName }
            // const result = await paymentCollection.find(quary).toArray()
            const result = await trainersCollection.findOneAndUpdate(
                { name: trainerName },
                { $pull: { slots: { name: name } } },
                { new: true }
            );
            res.send(result)
        })



        // payment related api -------------------------------------------
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })

        })
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const id = req.body.bookingId

            const classQuery = { name: payment.class }
            const paymentResult = await paymentCollection.insertOne(payment);
            const classUpdate = await classesCollection.findOne(classQuery)

            classUpdate.bookings += 1;
            await classesCollection.updateOne(classQuery, { $set: { bookings: classUpdate.bookings } });
            const query = {
                _id: new ObjectId(id)
            }


            const deleteResult = await bookingCollection.deleteOne(query);

            res.send({ paymentResult, deleteResult });
        })


        app.get("/lastPayment", verifytoken, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find({}).sort({ _id: -1 }).limit(6).toArray()
            res.send(result)
        })



        app.get('/totalPrice', async (req, res) => {

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;
            res.send({ revenue })
        });







        // Newsletter api -----------------------------------------------------------
        app.post("/newsletter", async (req, res) => {
            const data = req.body
            const emailQuery = { email: req.body.email }
            const email = await newsletterCollection.findOne(emailQuery)
            if (email) {
                res.status(400).json({ message: 'You already added your email to notify' });
            } else {
                const result = await newsletterCollection.insertOne(data)
                res.send(result)
            }

        })
        app.get("/newsletter", verifytoken, verifyAdmin, async (req, res) => {
            const result = await newsletterCollection.find().toArray()
            res.send(result)
        })
        app.get("/newsletter/count", verifytoken, verifyAdmin, async (req, res) => {
            const result = await newsletterCollection.countDocuments();
            res.send({ count: result });
        })



        // role selection related apis------------------------------------------ 
        app.get('/users/role/:email', verifytoken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);

            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            if (user.role === "admin") {
                return res.send({ role: 'admin' });
            }
            if (user.role === "trainer") {
                return res.send({ role: 'trainer' });
            }
            return res.send({ role: "user" });
        });









        // add slot -------------------------------------------------------------------------
        app.post('/addSlot', verifytoken, verifyTrainer, async (req, res) => {
            const data = req.body
            const email = req.body.email
            const query = { email: email }
            const options = { upsert: true };

            const updatetedData = {
                $set: {
                    specialties: req.body.specialties,
                    availableDays: req.body.availableDays,
                },
                $push: {
                    slots: req.body.slot,
                }
            }
            const result = await trainersCollection.updateOne(query, updatetedData, options)
            res.send(result)
        })


        // forum related api ------------------------------------------------------------
        app.post("/forumpost", async (req, res) => {
            const data = req.body
            const result = await forumCollection.insertOne(data)
            res.send(result)
        })
        app.get("/forumpost", async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const pageSize = 6;


            const skip = (page - 1) * pageSize;
            const result = await forumCollection.aggregate([{
                $sort: { _id: -1 }
            }, { $skip: skip },
            { $limit: pageSize },]).toArray()
            // const count = await forumCollection.countDocuments()
            res.send(result)
        })
        app.get("/forumpostHome", async (req, res) => {
            const result = await forumCollection.aggregate([{
                $sort: { _id: -1 }
            }, { $limit: 6 }]).toArray()

            res.send(result)
        })
        app.get("/forumpostCount", async (req, res) => {
            const count = await forumCollection.countDocuments()
            res.send({ count: count });
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})