// statsbot
var fs = require('fs')

function save(db) {
	fs.writeFileSync('./stats.json', JSON.stringify(db));
}

function read() {
	return fs.existsSync('./stats.json') ? JSON.parse(fs.readFileSync('./stats.json')) : {}
}

var log = require('log-simple')()

var VERSION = '0.1.2'
log.info('statsbot v' + VERSION)

// configuration
var config = require('./config.json')
if (config && config.debug) {
  log.setDebug(config.debug)
}
log.debug('successfully loaded configuration')

// db setup
var db = read()
if (!db.channels) db.channels = {}
if (!db.users) db.users = {}
save(db)

// client setup
var TelegramBot = require('node-telegram-bot-api')
var emoji = require('node-emoji').emoji

var bot = new TelegramBot(config.networks[0].token, {polling: true})

// bot begins here
function name (data) {
  if (!data) return undefined
  // FIXME: coffea-telegram workaround, channel should be .name not .title
  return (data.first_name && data.last_name && data.first_name + " " + data.last_name) || data.username || data.title
}

// event handlers
function processEvent (msg, type) {
  var c = name(msg.chat)
  var u = name(msg.from)
  log.debug('processing "' + type + '" event by "' + u + '" in "' + c + '"')

  if (c) {
    if (!db.channels[c]) db.channels[c] = { users: {} }
    if (!db.channels[c][type]) db.channels[c][type] = 0
    db.channels[c][type]++

	// if user
      if (!db.channels[c].users[u]) db.channels[c].users[u] = {}
      if (!db.channels[c].users[u][type]) db.channels[c].users[u][type] = 0
      db.channels[c].users[u][type]++
	
  }

  if (u) {
    if (!db.users[u]) db.users[u] = {}
    if (!db.users[u][type]) db.users[u][type] = 0
    db.users[u][type]++
  }
  save(db)
}

function processEventFactory (type) {
  return function (msg) {
    return processEvent(msg, type)
  }
}

// display stats
function stats (type, emoji) {
  return function typedStats (data) {
    return (data && data[type] ? data[type] : 0) + ' ' + emoji
  }
}

function cmdStats (data) {
  return (data && data.commands ? data.commands : 0) +
    ' ' + emoji.thought_balloon
}

var msgStats = stats('messages', emoji.speech_balloon)
var audioStats = stats('audio', emoji.sound)
var videoStats = stats('video', emoji.movie_camera)
var photoStats = stats('photo', emoji.mount_fuji)
var stickerStats = stats('sticker', emoji.rainbow)

function apply (arr, x) {
  return arr.map(function (f) {
    return f(x)
  })
}

function showStats (what, data) {
  return 'Stats for "' + what + '": ' +
    apply(
      [msgStats, stickerStats, photoStats, audioStats, videoStats]
    , data)
    .join(' | ')
}

function processCommand (msg, command) {
  var c = name(msg.chat)
  var u = name(msg.from)
  switch (command) {
    case 'stats':
      var repl = ''
	  var channel  = db.channels[c]
	  users = Object.keys(channel.users)
	  for (var i = 0; i < users.length; i++) {
		 repl += showStats(users[i], channel.users[users[i]])
		 if (i < users.length + 1) {
			 repl += '\n'
		 }
	  }
      bot.sendMessage(msg.chat.id, repl)
      break
    case 'help':
      bot.sendMessage(msg.chat.id, 'https://github.com/omnidan/statsbot/blob/master/README.md')
      break
    case 'emoji':
      bot.sendMessage(msg.chat.id, 'https://github.com/omnidan/statsbot/blob/master/README.md#what-do-the-emoji-mean')
      break
  }
}

// event listeners
bot.on('audio', processEventFactory('audio'))
bot.on('voice', processEventFactory('audio'))
bot.on('video', processEventFactory('video'))
bot.on('photo', processEventFactory('photo'))
bot.on('sticker', processEventFactory('sticker'))

bot.on('message', function (msg) {
	if(msg.text && msg.text.charAt(0) === '/') {
		var command = msg.text.substring(1, msg.text.length)
		processCommand(msg, command)
	} else {
		processEvent(msg, 'messages')
	}
})