const requestTestParseMission = false;

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
            inputPopup(missionName, [["Mission Name", "Mission Date and Time"], ["text", "datetime-local"]], (json, getPointerCampo, close) => {
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
            }, "Pubblica")
        })

        getMissionsList()


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
    send_request("/api/getAllMissions", "GET", { recordsLimit: recordsLimit }, (data) => {
        const jsonData = JSON.parse(data);
        $("#missionManagementCont").find(".missionDataContainer").remove();
        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)

            let mCont = $("<div class='missionDataContainer'></div>");
            let nameSpan = $("<span class='missionName'>" + m.missionInputData.MissionName + "</span>");
            let dateSpan = $("<span class='missionDate'>" + missionDate.toLocaleString("it-IT",{dateStyle:"short", timeStyle:"short"}) + "</span>");
            let btnCont = $("<div class='btnContainer'></div>")
            let delBtn = $('<button class="trash"><img src="https://icons.getbootstrap.com/assets/icons/trash-fill.svg" alt=""></button>');
            let uniqueLinkBtn = $("<a class='circular' href=\"/m/" + m._id + "\"><img src='https://icons.getbootstrap.com/assets/icons/link-45deg.svg'></a>");
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