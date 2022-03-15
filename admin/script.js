const requestTestParseMission = false;
var socket;

$(document).ready(() => {
    console.log("Admin");
    send_request("/api/admin/getAllMissionFiles", "GET", null, (data) => {
        const parsedData = JSON.parse(data);
        console.log(parsedData);
        parsedData.forEach((val, key) => {
            //console.log(val, key);
            $("#missionSelection").append("<option value=\"" + val.filePath + "\">" + val.missionName + "</option>")
        });
        $("#missionSelection").on("change", (snd) => {
            //$("#inpMissionData").fadeIn("fast");
            let sender = snd.target;
            let missionName = sender.options[sender.selectedIndex].innerHTML;

            
            send_request("/api/admin/getForumGroups", "GET", null, (data) => {
                const jsonData = JSON.parse(data);
                let blueGrpSel = $("<select multiple></select>");
                let redGrpSel = $("<select multiple></select>");
                for (let g of jsonData) {
                    blueGrpSel.append($("<option "+(g.selected?"selected":"")+">"+g.group_name+"</option>"));
                    redGrpSel.append($("<option "+(g.selected?"selected":"")+">"+g.group_name+"</option>"));
                }
                const inpObjs = [
                    {
                        title: "Mission Name",
                        name: "Mission Name",
                        type: "text"
                    },
                    {
                        title: "Mission Date and Time",
                        name: "Mission Date and Time",
                        type: "datetime-local"
                    },
                    {
                        title: "Blue Authorized Groups",
                        name: "authGroups-blue",
                        elm: blueGrpSel
                    },
                    {
                        title: "Red Authorized Groups",
                        name: "authGroups-red",
                        elm: redGrpSel
                    }
                ]
                console.log(inpObjs);
                inputPopupObjs(missionName, inpObjs, (json, getPointerCampo, close) => {
                    let dt = { missionFile: $("#missionSelection").val(), missionInputData: JSON.parse(json) };
                    console.log(dt);
                    let rq = sendRequestNoCallback("/api/admin/publishMission", "POST", dt);
                    console.log(rq);
                    rq.done((data, status, xhr) => {
                        console.log(data, status, xhr);
                        close();
                        getMissionsList();
                        //if(status==200)
                    })
                    rq.fail((data, status, xhr) => {
                    })
                    /*rq.error((err)=>{
                        console.error(data);
                    })*/
                }, "Pubblica", true, () => {
                    let options = $(sender).find(":selected")
                    options.removeAttr("selected")
                    console.log(options);
                })
            })
            //            inputPopup(missionName, [["Mission Name", "Mission Date and Time"], ["text", "datetime-local"]], (json, getPointerCampo, close) => {
        })

        getMissionsList()

        //startWebsocket();
        if (requestTestParseMission) {
            send_request("/api/admin/testParseMission", "GET", null, (data) => {
            })
        }
        /*$("#btnPubMission").on("click", () => {
            $("#inpMissionData").find("input").each((key, elm) => {
                //  if(this != elm)
                dt[elm.name] = elm.value;
                dt["missionFile"] = $("#missionSelection").value;
                if (elm.value != "") {
                    send_request("/api/admin/publishMission", "POST", dt, (res){

                    })
                } else {

                }
            })
        })*/
    })
})

function getMissionsList(recordsLimit = 30) {
    send_request("/api/getAllMissions", "GET", { recordsLimit: recordsLimit, showAll: true }, (data) => {
        const jsonData = JSON.parse(data);
        $("#missionManagementCont").find(".missionDataContainer").remove();
        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)

            let mCont = $("<div class='missionDataContainer'></div>");
            let nameSpan = $("<span class='missionName'>" + m.missionInputData.MissionName + "</span>");
            let dateSpan = $("<span class='missionDate'>" + missionDate.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) + "</span>");
            let btnCont = $("<div class='btnContainer'></div>")
            let delBtn = $('<button class="trash"><img src="https://icons.getbootstrap.com/assets/icons/trash-fill.svg" alt=""></button>');
            let uniqueLinkBtn = $("<a class='circular' target='__blank' href=\"/m/" + m._id + "\"><img src='https://icons.getbootstrap.com/assets/icons/link-45deg.svg'></a>");
            delBtn[0].mission_id = m._id;

            delBtn.click((e) => {
                console.log(e);
                inputPopup("Eliminare " + m.missionInputData.MissionName + "?", [[], []], (json, getPointerCampo, close) => {
                    send_request("/api/admin/removeMission", "GET", { mission_id: e.currentTarget.mission_id }, (data) => {
                        if (data == e.currentTarget.mission_id) {
                            close();
                            getMissionsList();
                        };
                    })
                }, "Elimina")
            })

            btnCont.append(uniqueLinkBtn, delBtn)
            mCont.append(nameSpan, dateSpan, btnCont)
            $("#missionManagementCont").append(mCont)
        }
    })
}