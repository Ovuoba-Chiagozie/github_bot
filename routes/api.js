const express = require('express')
const route = express.Router()
const pushToGitHub = require('../controllers/upload')

route.post('/upload', pushToGitHub)

module.exports = route