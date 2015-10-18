#!/usr/local/bin/node
var tpb = require('thepiratebay'), 
    inquirer = require('inquirer'),
    waiting_for_search = false,
    child = require("child_process"),
    fs = require("fs"),
    args = require("yargs")
        .option("search", {
            alias: "s",
            description: "pass search term directly",
            type: "string"
        })
        .option("all", {
            alias: "a",
            description: "play all files in torrent in order",
            type: "boolean"
        })
        .option("visualise", {
            alias: "v",
            description: "play visualisation of music. Requires vsxu_player",
            type: "boolean"
        })
        .option("night", {
            alias: "n",
            description: "turns on nightaudio. Requires nightaudio",
            type: "boolean"
        })
        .option("url", {
            alias: "u",
            description: "set Pirate Bay URL",
            type: "string"
        })
        .help("help")
        .argv,
    visualise = false,
    night = false,
    play_all_torrents = false,
    history,
    history_index;

initHistory()

if (args.url)
    tpb.setUrl = args.url

if (args.v)
    visualise = true;

if (args.night)
    night = true;

if (args.all)
    play_all_torrents = true;

function start(){
    if (args.search)
        search(args.search)
    else
        prompt_search()
}

function prompt_search(){
    var prompt = inquirer.prompt([{
        type: "input",
        name: "name",
        message: "What do you want to stream?",
    }], function(search_term) {
        history_listen()
        search(search_term.name)
    })
    history_listen(prompt)
}

function history_listen(prompt){
    var stdin = process.openStdin();
    if (prompt){
        process.stdin.setRawMode(true);    
        stdin.on('keypress', history_lookup);
    } else {
        stdin.removeListener('keypress', history_lookup)
    }

    function history_lookup(chunk, key){
        var last_search = history[history_index]
        if (last_search === undefined)
            return "History index error"
        if (key && key.name == 'up') {
            prompt.rl.line = history[history_index].search
            if (history_index > 0)
                history_index--
        }
        if (key && key.name == 'down') {
            prompt.rl.line = history[history_index].search
            if (history_index < history.length -1)
                history_index++
        }
    }
}

function initHistory(){
    try {
        history = require("./piratestream_history.json")
        if (!Array.isArray(history))
            throw "History file is corrupted. Replacing...";
    } catch(e) {
        if (e.code != "MODULE_NOT_FOUND")
            console.log(e)
        history = []
    }

    history_index = history.length - 1;
}


function search(name){
    waiting_for_search = true
    history.push({
        "search": name,
        "date" : new Date()
    })
    var out = JSON.stringify(history)
    fs.writeFile("piratestream_history.json", out, function(err){
        if (err) throw "Couldn't write history to file", err
    })
    searching()
    tpb.search(name, {
        category: '0',
        orderBy: '7',
        page: '0'
    }).then(choose)
}

function searching(){
    process.stdout.write("Searching")
    var interval = setInterval(function() {
        if (waiting_for_search == true){
            process.stdout.write(".")
        } else {
            clearInterval(interval)
        }
    }, 1000)
}

function choose(results){
    if (results.length == 0){
        console.log("No results.")
        start()
    }
    waiting_for_search = false;
    var choices = {};
    for (var i in results) choices[results[i].name] = results[i].magnetLink;
    inquirer.prompt([{
        type: "list",
        name: "name",
        message: "Choose a torrent",
        choices: function(){
            var arr = []
            for (var i in results){
                arr.push({
                    name: results[i].name + " - " + results[i].seeders + " seeders - " + results[i].size,
                    value: results[i].name
                })
            }
            return arr
        }
    }], function(choice){
        var magnet = choices[choice.name]
        if (magnet){
            var peerflix = child.spawn("peerflix", [magnet, "-a", "--vlc", "-- --fullscreen"]),
                end = new RegExp(/and ?\d+ more/),
                closed = false;
            peerflix.stdout.on('data', function (data) {
                data = data.toString()
                    .replace(/^\s*\n/gm, "") 
                process.stdout.write(data);
                if (end.test(data.toString()))
                    process.stdout.write("\033[1;1H")
            });
            process.on('exit', function(){
                cleanup()
            })
            process.on('close', function(code, signal){
                cleanup()
            })
            process.on('SIGINT', function(code, signal){
                cleanup()
            })
            process.on('SIGTERM', function(code, signal){
                cleanup()
            })
            if (visualise)
                start_visualisation();
        } else {
            console.log("No magnet link for", choice.name)
        }
    })
}

function cleanup(){
    process.stdout.write("\033[2J")
    if (visualise)
        child.exec("xrandr", ["--auto"]);
}

function start_visualisation(){
    // Wait for VLC to start up
    setTimeout(function(){
        child.spawn("vsxu_player",["-f", "-s", "3286x1080"])
        if (night)
            child.exec("nightaudio", ["tv"])
    }, 6000)
}

start()