const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const nodemailer = require("nodemailer");
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb')
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// send email 
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.TRANSPORT_EMAIL,
      pass: process.env.TRANSPOST_PASS,
    },
  });


  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });

  const mailBody = {
    from: `"StayVista" <${process.env.TRANSPORT_EMAIL}>`, // sender address
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
  }

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error)
    } else {
      console.log('Email sent: ' + info.response)
    }
  });

  // console.log("Message sent: %s", info.messageId);

}
// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zwicj3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('stayvista')
    const roomCollection = db.collection('rooms')
    const usersCollection = db.collection('users')
    const bookingsCollection = db.collection('bookings')

    // verify admin middleware 
    const verifyAdmin = async (req, res, next) => {
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      console.log(result?.role)
      if (!result || result?.role !== 'admin')
        return res.status(401).send({ messeage: 'unauthorized accesss!!' })
      next()
    }
    // verify host middleware 
    const verifyHost = async (req, res, next) => {
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      console.log(result?.role)
      if (!result || result?.role !== 'host')
        return res.status(401).send({ messeage: 'unauthorized accesss!!' })
      next()
    }

    // payment releted api 
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const price = req.body.price
      const pricecInCent = parseFloat(price) * 100

      const { client_secret } = await stripe.paymentIntents.create({
        amount: pricecInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      })

      res.send({ clientSecret: client_secret })
    })
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    //SAVE add a new user in database
    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };

      // cheek user already exist
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        if (user?.status === 'Requested') {
          const result = await usersCollection.updateOne(query, { $set: { status: user?.status } })
          return res.send(result)
        } else {
          return res.send(isExist)
        }
      }

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)

      // welcome email new user
      sendEmail(user?.email, {
        subject: 'Welcome to StayVista!',
        message: `Browse rooms and book them.`,
      })
      res.send(result)
    })

    //get an loogged user by email
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })
    // get all users from db 
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // update user a role by admin
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const query = { email }
      const user = req.body
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // get data room from roomCollection 
    app.get('/rooms', async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category && category !== 'null') query = { category }
      const result = await roomCollection.find(query).toArray();
      res.send(result)
    })

    // save Post a roomData 
    app.post('/room', verifyToken, verifyHost, async (req, res) => {
      const roomData = req.body;
      const result = await roomCollection.insertOne(roomData)
      res.send(result)
    })

    //get myListings data from room 
    app.get('/my-listings/:email', verifyToken, verifyHost, async (req, res) => {
      const email = req.params.email;
      let query = { 'host.email': email };
      const result = await roomCollection.find(query).toArray();
      res.send(result)
    })

    // room delete from host user 
    app.delete('/room/:id', verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomCollection.deleteOne(query)
      res.send(result)
    })
    // get single room data  
    app.get('/room/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await roomCollection.findOne(query);
      res.send(result)
    })

    // save Post a booking data 
    app.post('/booking', verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData)

      // send email to guest 
      sendEmail(bookingData?.guest?.email, {
        subject: 'Booking Successful',
        message: `You have successfully booked a room through StayVista. Transaction Id: ${bookingData?.transactionId}`,
      })

      // send email to host 
      sendEmail(bookingData?.host?.email, {
        subject: 'Your room got booked!',
        message: `Get ready to welcome ${bookingData?.guest?.name}`,
      })

      res.send(result)
    })

    // update room data from host 
    app.put('/room/update/:id', verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const roomData = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: roomData,
      }
      const result = await roomCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // update rooms data status 
    app.patch('/room/status/:id', async (req, res) => {
      const id = req.params.id
      const status = req.body.status
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { booked: status },
      }
      const result = await roomCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // get all my booking data  
    app.get('/my-bookings/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { 'guest.email': email }
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })

    // get all manage booking for host  
    app.get('/manage-bookings/:email', verifyToken, verifyHost, async (req, res) => {
      const email = req.params.email
      const query = { 'host.email': email }
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })
    // booking cenceld from guest user 
    app.delete('/booking/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query)
      res.send(result)
    })


    // admin statistics data 
    app.get('/admin-stat', verifyToken, verifyAdmin, async (req, res) => {
      const bookingDetails = await bookingsCollection.find({}, {
        projection: {
          date: 1,
          price: 1
        }
      }).toArray()
      console.log(bookingDetails)
      const totalUsers = await usersCollection.countDocuments()
      const totalRooms = await roomCollection.countDocuments()
      const totalPrice = bookingDetails.reduce((sum, booking) => sum + booking.price, 0)

      //   const data = [
      //     ['Day', 'Sales'],
      //     ['9', 1000],
      //     ['10', 1170],
      //     ['11', 660],
      //     ['12', 1030],
      // ]
      const chartData = bookingDetails.map(booking => {
        const days = new Date(booking.date).getDay()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${days}/${month} `, booking?.price]
        return data
      })

      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0,0,['Dayyyy', 'Sales'])
      res.send({
        totalUsers,
        totalRooms,
        totalBookings: bookingDetails?.length,
        totalPrice,
        chartData
      })
    })

    // host statistics data 
    app.get('/host-stat', verifyToken, verifyHost, async (req, res) => {
      const email = req.user.email
      const bookingDetails = await bookingsCollection.find({ 'host.email': email }, {
        projection: {
          date: 1,
          price: 1
        }
      }).toArray()
      console.log(bookingDetails)
      const totalRooms = await roomCollection.countDocuments({ 'host.email': email })
      const totalPrice = bookingDetails.reduce((sum, booking) => sum + booking.price, 0)

      const { timestamp } = await usersCollection.findOne({ email },
        { projection: { timestamp: 1 } }
      )

      const chartData = bookingDetails.map(booking => {
        const days = new Date(booking.date).getDay()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${days}/${month} `, booking?.price]
        return data
      })

      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0,0,['Dayyyy', 'Sales'])
      res.send({
        totalRooms,
        totalBookings: bookingDetails?.length,
        totalPrice,
        chartData,
        hostSince: timestamp,
      })
    })

    // gues statistics data 
    app.get('/guest-stat', verifyToken, async (req, res) => {
      const email = req.user.email
      const bookingDetails = await bookingsCollection.find({ 'guest.email': email }, {
        projection: {
          date: 1,
          price: 1
        }
      }).toArray()
      console.log(bookingDetails)

      const totalPrice = bookingDetails.reduce((sum, booking) => sum + booking.price, 0)

      const { timestamp } = await usersCollection.findOne({ email },
        { projection: { timestamp: 1 } }
      )

      const chartData = bookingDetails.map(booking => {
        const days = new Date(booking.date).getDay()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${days}/${month} `, booking?.price]
        return data
      })

      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0,0,['Dayyyy', 'Sales'])
      res.send({
        totalBookings: bookingDetails?.length,
        totalPrice,
        chartData,
        guestSince: timestamp,
      })
    })
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
