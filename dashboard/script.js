$(document).ready(() => {
    send_request("/api/getAllMissions" + location.pathname, "GET", null, (data) => {
        const jsonData = JSON.parse(data);
        
        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)
            $("#missionSelection").append("<option value=\"" + m._id + "\">" + toUpperFirstChar(m.missionInputData.MissionName) + ": " + missionDate.toLocaleDateString("it-IT", {}) + "</option>");
        }
        $("#missionSelection").on("change", (e) => {
            let missionId = e.target.value;
            send_request("/api/getMissionDetails", "GET", { missionId: missionId }, (data) => {
                const jsonData = JSON.parse(data);
                console.log(jsonData);
                //console.log(jsonData.parsedMiz.blue);
                $("#tableContainer").find("table").remove();
                createTable(jsonData.parsedMiz, jsonData._id, "blue/red")
                //createTable(jsonData.parsedMiz.red, "red")
            });
        })
        $("#missionSelection option:eq(1)").prop('selected', true)
        $("#missionSelection").trigger("change")
        if(jsonData.length<=1) $("#missionSelection").attr("disabled","disabled");
    })
})

function login() {
    inputPopup("Login", [["Username", "Password"], ["text", "password"]], (json, getPointerCampo, close) => {
        send_request("/api/login", "POST", JSON.parse(json), (data) => {
            const jsonData = JSON.parse(data);
            console.log(jsonData);
            switch (jsonData.status) {
                case 'login_ok':
                    console.log(jsonData.userDt);
                    localStorage.setItem("stok", jsonData.userDt.token);
                    localStorage.setItem("username", jsonData.userDt.username);
                    localStorage.setItem("uid", jsonData.userDt.id)
                    close();
                    location.reload();
                    break;
                case 'wrong_credentials':
                    getPointerCampo("Username").css("background-color", "#f77");
                    getPointerCampo("Password").css("background-color", "#f77");
                    break;
            }
        });
    }, "Login", false);
}

function createTable(parsedMiz, missionId, sideFilter) {
    let table = $("<table><tr><th>Flight</th><th>Task</th><th>Slots</th></tr></table>");
    let myBookedMissions = [];
    //$(".mainContainer")
    Object.entries(parsedMiz).forEach(entry => {
        const [k, v] = entry;
        let sideColor = k;
        if (sideFilter.includes(k)) {
            Object.entries(v).forEach(entry => {
                const [k, v] = entry;
                const showAI = false;
                if ((v.skill == "Client" || v.units[Object.keys(v.units)[0]].skill == "Client") || showAI) {
                    table.append("<tr class='rowSpacer'></tr>");
                    const unitsCount = count(v.units);
                    let flightName = k;
                    let row = $("<tr><td class='flightTD' rowspan=\"" + unitsCount + "\"><div class='flightContainer'><span class='aircraftType'>" + v.aircraftType + "</span><span class='groupName'>" + (v.callsign && v.callsign.name ? (v.callsign.name) + "-" + v.callsign.group : k) + "</span></div></td></tr>");
                    table.append(row);
                    Object.entries(v).forEach(entry => {
                        const [k, v] = entry;
                        if (["task"].includes(k)) {
                            if (!isObject(v)) {
                                let td = $("<td class='colId " + k + " " + v + "' rowspan=\"" + unitsCount + "\">" + v + "</td>");
                                row.append(td);
                            }
                        }
                    });

                    /*
                    let sUnits = v.units.sort((a, b) => { return a.slotN - b.slotN; })
                    console.log(sUnits);
                    */
                    Object.entries(v.units).forEach(entry => {
                        const [k, v] = entry;

                        let td = $("<td>" + v + "</td>");
                        let playerBooked = v.player && v.player != "";
                        let aircraftN = v.slotN ? v.slotN : k;
                        if (aircraftN > 10) aircraftN = (aircraftN / 10);
                        let tdElm = $("<td class='playerContainer " + sideColor + " " + (playerBooked ? "booked" : "") + "'><div class='horizontalScrolling'><span class='inFlightNumber'>" + aircraftN + "</span><span class='playerNameContainer'>" + (playerBooked ? v.player : "") + "</span></div></td>");
                        if (v.multicrew) tdElm.addClass("multicrew");
                        if (unitsCount == 1) tdElm.addClass("singleSlot");
                        tdElm[0].playerBooked = playerBooked;
                        let par = { missionId: missionId, sideColor: sideColor, flight: flightName, spec: v, inflightNumber: k };

                        if (!v.user_id || v.user_id == -1 || v.user_id == parseInt(getCookie("uid"))) {
                            tdElm.css("cursor", "pointer")
                            tdElm.click(() => {
                                if (!tdElm[0].playerBooked) {
                                    _bookMission();
                                } else {
                                    _dismissMission();
                                }
                            })
                            if (v.user_id == parseInt(getCookie("uid"))) {
                                myBookedMissions.push(tdElm);

                            }
                        }

                        function _bookMission() {
                            /*console.log("[EVT SET] Book mission");
                            tdElm.click(() => {*/
                            for (let t of myBookedMissions) {
                                if (t != null)
                                    t.trigger("click");
                            }
                            myBookedMissions = [];
                            console.log("Booking mission", par);
                            send_request("/api/bookMission", "GET", par, (data) => {
                                const jsonData = JSON.parse(data);
                                tdElm.addClass("booked");
                                tdElm.find(".playerNameContainer").html(jsonData.playerName);
                                tdElm[0].playerBooked = true;
                                myBookedMissions.push(tdElm)
                            })
                            //})
                        }
                        function _dismissMission() {
                            /*console.log("[EVT SET] Dismiss mission");
                            tdElm.click(() => {*/
                            myBookedMissions[myBookedMissions.indexOf(tdElm)] = null;
                            console.log("Dissmissing mission");
                            send_request("/api/dismissMission", "GET", par, (data) => {
                                const jsonData = JSON.parse(data);
                                //console.log(jsonData);
                                if (jsonData.removed == "ok") {
                                    tdElm.removeClass("booked");
                                    tdElm[0].playerBooked = false;
                                    setTimeout(() => {
                                        tdElm.find(".playerNameContainer").html("");
                                    }, 100)
                                }
                            })
                            //})
                        }
                        if (k == 1)
                            row.append(tdElm);
                        else {
                            let tmpTr = $("<tr></tr>")
                            tmpTr.append(tdElm);
                            table.append(tmpTr);
                        }
                    });

                }
            })
        }
    })
    $("#tableContainer").append(table);
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
