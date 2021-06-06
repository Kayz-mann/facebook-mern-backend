import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import multer from "multer"
import GridFsStorage from "multer-gridfs-storage"
import Grid from "gridfs-stream"
import path from "path"
import Pusher from "pusher"
import mongoPosts from "./postModel.js" 

Grid.mongo =  mongoose.mongo

// app config
const app = express()
const port = process.env.PORT || 9000

const pusher = new Pusher({
    appId: "1199167",
    key: "286748485c313925b6d8",
    secret: "3edf8ad1a423d50fe4b0",
    cluster: "eu",
    useTLS: true
  });
  


// middlewares
app.use(express.json())
app.use(cors())

// db config
const mongoURI="mongodb+srv://kayode:tetraoxochamber4@cluster0.9pbyj.mongodb.net/facebook-backend?retryWrites=true&w=majority"

const conn = mongoose.createConnection(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
})

mongoose.connection.once("open", () => {
    console.log("DB connected")

    const changeStream = mongoose.connection.collection("posts").watch()

    changeStream.on("change", (change) => {
        console.log(change)

        if (change.operationType === "insert") {
            console.log("Triggering Pusher")

            pusher.trigger("posts", "inserted", {
                change: change
            })
        } else {
            console.log("Error triggering Pusher")
        }
    })
})

// for saving large files
let gfs

conn.once("open", () => {
    console.log("DB connected")

    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection("images")
})

const storage = new GridFsStorage ({
    url:mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = `image-${Date.now()}${path.extname(file.originalname)}`

            const fileInfo = {
                filename: filename,
                bucketName: "images"
            }

            resolve(fileInfo);
        })
    }
})


const upload = multer({ storage })

mongoose.connect(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true

})

// api routes
app.get("/", (req, res) => res.status(200).send("hello world"))
app.post("/upload/image", upload.single("file"), (req, res) => {
    res.status(201).send(req.file)
})

app.post("/upload/post", (req, res) => {
    const dbPost  = req.body

    mongoPosts.create(dbPost, (err, data) => {
        if (err) {
            res.status(500).send(err)
        } else {
            res.status(201).send(data)
        }
    })
})



// retrieve images per posts
app.get("/retrieve/image/single", (req, res) => {
    gfs.files.findOne({ filename: req.query.name }, (err, file) => {
        if (err) {
            res.status(500).send(err)
            
        } else {
            if (!file || file.length === 0) {
                res.status(404).json({ err: "file not found" })
                console.log(err)
            } else {
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            }
        }
    })
})

// retrieve posts
app.get("/retrieve/posts", (req, res) => {
    mongoPosts.find((err, data) => {
        if (err) {
            res.status(500).send(err)
            
        } else {
            data.sort((b, a) => {
                return a.timestamp - b.timestamp;
            })
            res.status(200).send(data)
        }
    })
})

// listen
app.listen(port, () => console.log(`listening on localhost: ${port}`))