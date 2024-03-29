const WS_URL = "w" + location.protocol.replace(/http/g, '').replace(/:/g, '') + "s:" + location.host;
$(document).ready(() => {
    send_request("/api/getAllMissions" + location.pathname, "GET", null, (data) => {
        const jsonData = JSON.parse(data);

        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)
            $("#missionSelection").append("<option value=\"" + m._id + "\">" + toUpperFirstChar(m.missionInputData.MissionName) + ": " + missionDate.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) + "</option>");
        }
        $("#missionSelection").on("change", (e) => {
            let missionId = e.target.value;
            send_request("/api/getMissionDetails", "GET", { missionId: missionId }, (data) => {
                const jsonData = JSON.parse(data);
                console.log(jsonData);
                //console.log(jsonData.parsedMiz.blue);
                $("#tableContainer").find("table").remove();

                createTable(jsonData, jsonData._id, "blue/red")
                //createTable(jsonData.parsedMiz.red, "red")
                rightMouseButtonEvt();
            });
        })
        $("#missionSelection option:eq(1)").prop('selected', true)
        $("#missionSelection").trigger("change")
        if (jsonData.length <= 1) $("#missionSelection").attr("disabled", "disabled");
    })
    createContextMenu()

    startWebsocket();
})

function login() {
    inputPopup("Login", [ [ "Username", "Password" ], [ "text", "password" ] ], (json, getPointerCampo, popupClose) => {
        send_request("/api/login", "POST", JSON.parse(json), (data) => {
            const jsonData = JSON.parse(data);
            console.log(jsonData);
            switch (jsonData.status) {
                case 'login_ok':
                    console.log(jsonData.userDt);
                    localStorage.setItem("stok", jsonData.userDt.token);
                    localStorage.setItem("username", jsonData.userDt.username);
                    localStorage.setItem("uid", jsonData.userDt.id)
                    popupClose();
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

let myBookedMissions = [];
function createTable(orMizData, missionId, sideFilter) {
    let briefingBanner = $(`<div class="banner"><img src="/icons/warning.svg" /><a href="${orMizData.missionInputData.briefing_url}" target="blank">Clicca qui per visualizzare il Briefing missione</a></div>`)
    let table = $("<table><tr><th>Flight</th><th>Task</th><th>Base</th><th>Slots</th></tr></table>");
    //$(".mainContainer")
    const parsedMiz = orMizData.parsedMiz;
    // parsedMiz["blue"] = orParsedMiz.blue.sort((a, b) => { return a.slotN - b.slotN; })
    // parsedMiz["red"] = orParsedMiz.red.sort((a, b) => { return a.slotN - b.slotN; })
    // parsedMiz["neutrals"] = orParsedMiz.neutrals.sort((a, b) => { return a.slotN - b.slotN; })

    Object.entries(parsedMiz).forEach(entry => {
        const [ k, v ] = entry;
        let sideColor = k;
        if (sideFilter.includes(k)) {
            Object.entries(v).forEach(entry => {
                const [ k, v ] = entry;
                const showAI = false;
                if ((v.skill == "Client" || v.units[ Object.keys(v.units)[ 0 ] ].skill == "Client") || showAI) {
                    table.append("<tr class='rowSpacer'></tr>");
                    const unitsCount = count(v.units);
                    let flightName = k;
                    v.simpleAircraftType = v.aircraftType.replace(/_50|_hornet|_BLK_II|_2|-135-GR/g, '');
                    let row = $("<tr><td class='flightTD' rowspan=\"" + unitsCount + "\"><div class='flightContainer'><span class='aircraftType'>" + v.simpleAircraftType + "</span><span class='groupName'>" + (v.callsign && v.callsign.name ? (v.callsign.name) + "-" + v.callsign.group : k) + "</span></div></td></tr>");
                    table.append(row);
                    Object.entries(v).forEach(entry => {
                        const [ k, v2 ] = entry;
                        if ([ "task", "airport_name" ].includes(k)) {
                            if (!isObject(v2)) {
                                let appendVal = v2;
                                if (k == "airport_name") {
                                    if (v2 == "" && v.helipad_id) {
                                        appendVal = parsedMiz.helipads_data[ sideColor ].find((e) => e && e.unit_id && e.unit_id == v.helipad_id)
                                        appendVal = (appendVal.name ? appendVal.name : "").replace(/\_/g, '-');
                                    } else if (!v.helipad_id && !v.airport_id) appendVal = "Air"
                                }
                                let td = $("<td class='colId " + k + " " + v2 + "' rowspan=\"" + unitsCount + "\">" + appendVal + "</td>");
                                row.append(td);
                            }
                        }
                    });

                    /*
                    let sUnits = v.units.sort((a, b) => { return a.slotN - b.slotN; })
                    console.log(sUnits);
                    */
                    Object.entries(v.units).forEach(entry => {
                        const [ k, v ] = entry;

                        let playerBooked = v.player && v.player != "";
                        let aircraftN = v.slotN ? v.slotN : k;
                        if (aircraftN > 10) aircraftN = (aircraftN / 10);
                        let multicrewStr = (v.multicrewN > 1 ? "-" + v.multicrewN : "");
                        let tdElm = $("<td class='playerContainer " + sideColor + " " + (playerBooked ? "booked" : "") + " " + (v.priority ? "priority" : "") + "'><div class='horizontalScrolling'><span class='inFlightNumber'>" + aircraftN + multicrewStr + "</span><span class='playerNameContainer'>" + (playerBooked ? v.player : "") + "</span></div></td>");
                        if (v.multicrew) tdElm.addClass("multicrew");
                        if (v.reserved) tdElm.addClass("reserved");
                        if (unitsCount == 1) tdElm.addClass("singleSlot");
                        tdElm[ 0 ].playerBooked = playerBooked;
                        let par = { missionId: missionId, sideColor: sideColor, flight: flightName, spec: v, inflightNumber: k };
                        tdElm[ 0 ].flightRef = par;

                        if (!v.user_id || v.user_id == -1 || v.user_id == parseInt(getCookie("uid"))) {
                            tdElm.css("cursor", "pointer")
                            tdElm.click(() => {
                                if (!tdElm[ 0 ].playerBooked) {
                                    _bookMission(tdElm[ 0 ]);
                                } else {
                                    _dismissMission(tdElm[ 0 ]);
                                }
                            })
                            if (v.user_id == parseInt(getCookie("uid"))) {
                                myBookedMissions.push(tdElm[ 0 ]);

                            }
                        }

                        function _bookMission(mizElm) {
                            let par = mizElm.flightRef;
                            /*console.log("[EVT SET] Book mission");
                            tdElm.click(() => {*/
                            getAppPersonalization((data) => {
                                if (data.dashboard.preBookingConfirmation) {
                                    inputPopup(data.dashboard.preBookingConfText, [ [], [] ], (json, getPointerCampo, close) => {
                                        console.log(json);
                                        procBook();
                                    })
                                } else {
                                    procBook();
                                }
                            })
                            function procBook() {
                                for (let t of myBookedMissions) {
                                    if (t != null && t.playerBooked) {
                                        console.log(t);
                                        _dismissMission(t);
                                    }
                                }
                                myBookedMissions = [];
                                console.log("Booking mission", par);
                                send_request("/api/bookMission", "GET", par, (data) => {
                                    const jsonData = JSON.parse(data);
                                    grBook(tdElm[ 0 ], jsonData.playerName)
                                    //myBookedMissions.push(tdElm)
                                })
                            }
                        }
                        function _dismissMission(mizElm) {
                            let par = mizElm.flightRef;
                            /*console.log("[EVT SET] Dismiss mission");
                            tdElm.click(() => {*/
                            if (myBookedMissions.indexOf(tdElm[ 0 ]) >= 0) myBookedMissions[ myBookedMissions.indexOf(tdElm[ 0 ]) ] = null;
                            console.log("Dissmissing mission");
                            send_request("/api/dismissMission", "GET", par, (data) => {
                                const jsonData = JSON.parse(data);
                                //console.log(jsonData);
                                if (jsonData.removed == "ok") {
                                    grDismiss(mizElm);
                                }
                            })
                            //})
                        }
                        if (k == 0)
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

    if (orMizData.missionInputData.briefing_url && orMizData.missionInputData.briefing_url != "") $("#tableContainer").append(briefingBanner)
    $("#tableContainer").append(table);
}

function recursiveCellCreator(k, v) {
    if (!isObject(v)) {
        let td = $("<td rowspan=\"" + unitsCount + "\">" + v + "</td>");
        row.append(td);
    } else {
        console.log(k, v);
        Object.entries(v).forEach(entry => {
            const [ k, v ] = entry;
            let td = $("<td>" + v + "</td>");
            row.append(td);
        });
    }
}
function grBook(miz, playerName) {
    $(miz).addClass("booked");
    $(miz).find(".playerNameContainer").html(playerName);
    miz.playerBooked = true;
    if (localStorage.username == playerName)
        myBookedMissions.push(miz)
}
function grDismiss(miz) {
    console.log(myBookedMissions);
    $(miz).removeClass("booked");
    miz.playerBooked = false;
    setTimeout(() => {
        $(miz).find(".playerNameContainer").html("");
    }, 100)
}
function count(obj) { return Object.keys(obj).length; }
function isObject(elm) { return (typeof elm === 'object' && elm !== null) }

function rightMouseButtonEvt() {
    $("body").bind("contextmenu", function (e) {
        contextMenu.removeClass("visible");
        return false;
    });
    $("body").bind("click", function (e) {
        if (!contextMenu.find(e.target)[ 0 ]) {
            contextMenu.close();
        }
    });
    $(".playerContainer").on("long-press", (e) => {
        e.pageY = e.currentTarget.getBoundingClientRect().top + 20;
        e.pageX = e.currentTarget.getBoundingClientRect().left + 20;
        console.log("long", e);
        openContextMenu(e);
        return false;
    })

    $(".playerContainer").bind("contextmenu", openContextMenu);
    function openContextMenu(e) {
        contextMenu[ 0 ].senderElm = e.currentTarget;
        const left = Math.min(e.pageX, ($(window).width() - contextMenu.width() - 10))
        const top = Math.min(e.pageY, ($(document).height() - contextMenu.height() - 20));
        console.log(e);
        contextMenu.css({
            top: top,
            left: left
        })
        setTimeout(() => {
            contextMenu.addClass("visible");
        }, 10)
        return false;
    }
}

let contextMenu;
function createContextMenu() {
    contextMenu = $("<div id='contextMenu'></div>");
    send_request("/api/getContextMenu", "GET", {}, (data) => {
        const jsonData = JSON.parse(data);
        for (let b of jsonData) {
            let btn = $("<button>" + b.name + "</button>");
            btn[ 0 ].customContext = b;

            btn.click((e) => {
                const sender = e.target.parentNode.senderElm;
                let par = { ...sender.flightRef };
                console.log(par);
                par.customContext = e.target.customContext;
                $(e.target).addClass("request waiting")
                send_request(b.url, b.method, par, (data) => {
                    $(e.target).addClass("success")
                    $(e.target).removeClass("waiting")
                    const jsonData = JSON.parse(data);
                    //$(sender).find(".playerNameContainer").html(jsonData.playerName)
                    contextMenu.close(500);
                }, false, () => {
                    $(e.target).addClass("fail")
                    $(e.target).removeClass("waiting")
                    contextMenu.close(500);
                })
            })
            contextMenu.append(btn)
        }
    })
    contextMenu.close = (timeout = 0) => {
        setTimeout(() => {
            contextMenu.removeClass("visible");
            contextMenu.find("button").removeClass("request waiting success fail");
        }, timeout)
    }
    $("body").append(contextMenu)
}

function startWebsocket() {
    socket = new WebSocket(WS_URL);
    socket.onopen = function (e) {
        console.log("Websocket connected to ", "tomare");
    };
    socket.onmessage = (e) => {
        //console.log(JSON.parse(e.data));
        wsAction(JSON.parse(e.data));
    }
    socket.onclose = function (event) {
        if (event.wasClean) {
            console.log("[close] Connection closed cleanly, code=${event.code} reason=${event.reason}");
        } else {
            console.log("[close] Connection died");
        }

        setTimeout(function () {
            startWebsocket();
        }, 100)
    };
}

function wsAction(jsonData) {
    let tgCell;
    $(".playerContainer").each((key, elm) => {
        if (detectSlot(elm.flightRef, jsonData.slotData)) {
            tgCell = elm
        }
    })
    switch (jsonData.action) {
        case "booking":
            grBook(tgCell, jsonData.playerName);
            break;
        case "dissmission":
            grDismiss(tgCell);
            break;
        case "priority":
            console.log(tgCell);
            if (jsonData.value) $(tgCell).addClass("priority");
            else $(tgCell).removeClass("priority");
            break;
        case "attribute":
            if (jsonData.value) $(tgCell).addClass(jsonData.attr);
            else $(tgCell).removeClass(jsonData.attr);
            break;

        default:
            console.log("def", tgCell);
            break;
    }
}

function detectSlot(obj1, obj2) {
    return (obj1.flight == obj2.flight && obj1.missionId == obj2.missionId && obj1.inflightNumber == obj2.inflightNumber && obj1.sideColor == obj2.sideColor && obj1.spec.parking == obj2.spec.parking);

}
function isEqualsJson(obj1, obj2) {
    keys1 = Object.keys(JSON.parse(JSON.stringify(obj1)));
    keys2 = Object.keys(JSON.parse(JSON.stringify(obj2)));
    console.log(obj1, obj2);

    //return true when the two json has same length and all the properties has same value key by key
    return keys1.length == keys2.length && Object.keys(obj1).every(key => obj1[ key ] == obj2[ key ]);
}
function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[ i ];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}