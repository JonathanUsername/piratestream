#!/usr/local/bin/node
var tpb = require('thepiratebay'), 
    inquirer = require('inquirer'),
    waiting_for_search = false,
    spawn = require("child_process").spawn;

var questions = [{
    type: "input",
    name: "name",
    message: "What do you want to stream?",
}]

inquirer.prompt([{
    type: "input",
    name: "name",
    message: "What do you want to stream?",
}], function(search_term) {
    search(search_term.name)
})

function search(name){
    waiting_for_search = true
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
    waiting_for_search = false;
    var choices = {};
    for (var i in results) choices[results[i].name + " - " + results[i].seeders + " seeders - " + results[i].size] = results[i].magnetLink;
    inquirer.prompt([{
        type: "list",
        name: "name",
        message: "Choose a torrent",
        choices: results
    }], function(choice){
        var magnet = choices[choice.name]
        if (magnet){
            var peerflix = spawn("peerflix", [magnet, "-a", "--vlc"])
            peerflix.stdout.on('data', function (data) {
                process.stdout.write(data);
            });
        } else {
            console.log("No magnet link for", choice.name)
        }
    })
}
