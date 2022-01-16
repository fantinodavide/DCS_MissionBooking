$(document).ready(() => {
    send_request("/api/getAllMissions", "GET", null, (data) => {
        const jsonData = JSON.parse(data);
        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)
            $("#missionSelection").append("<option value=\"" + m._id + "\">" + toUpperFirstChar(m.missionInputData.MissionName) + ": " + missionDate.toLocaleDateString("it-IT", {}) + "</option>");
        }

        $("#missionSelection").on("change", (e) => {
            const missionId = e.target.value;
            send_request("/api/getMissionDetails", "GET", { missionId: missionId }, (data) => {
                const jsonData = JSON.parse(data);
                console.log(jsonData.parsedMiz.blue);

                createTable(jsonData.parsedMiz.blue)

            });
        })
    })
})

function createTable(faction) {
    let table = $("<table><tr><th>Group</th><th>Task</th><th>Aircraft</th><th>Slots</th></tr></table>");
    //$(".mainContainer")
    Object.entries(faction).forEach(entry => {
        const [k, v] = entry;
        const showAI = false;
        if(v.units[1].skill == "Client"||showAI){
            const unitsCount = count(v.units);
    
            let row = $("<tr><td rowspan=\"" + unitsCount + "\">" + k + "</td></tr>");
            table.append(row);
            Object.entries(v).forEach(entry => {
                const [k, v] = entry;
                if (!isObject(v)) {
                    let td = $("<td rowspan=\"" + unitsCount + "\">" + v + "</td>");
                    row.append(td);
                }
            });
            
            Object.entries(v.units).forEach(entry => {
                const [k, v] = entry;
                let td = $("<td>" + v + "</td>");
                if (k == 1)
                row.append("<td>" + k + "</td>");
                else
                table.append("<tr><td>" + k + "</td></tr>");
            });
            table.append("<tr class='rowSpacer'></tr>");

        }
    })
    $(".mainContainer").append(table);
}
function recursiveCellCreator(k, v) {
    if (!isObject(v)) {
        let td = $("<td rowspan=\"" + unitsCount + "\">" + v + "</td>");
        row.append(td);
    } else {
        console.log(k, v);
        Object.entries(v).forEach(entry => {
            const [k, v] = entry;
            let td = $("<td>" + v + "</td>");
            row.append(td);
        });
    }
}

function count(obj) { return Object.keys(obj).length; }
function isObject(elm) { return (typeof elm === 'object' && elm !== null) }


