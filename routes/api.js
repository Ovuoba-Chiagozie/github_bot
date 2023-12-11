const express = require('express')
const route = express.Router()
const uploadFile = require('../controllers/upload')

route.get('/upload', uploadFile)

module.exports = route