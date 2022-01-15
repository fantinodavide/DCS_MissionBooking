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
                let dt = {missionFile: $("#missionSelection").val(), missionInputData: JSON.parse(json)};
                console.log(dt);
                let rq = sendRequestNoCallback("/api/admin/publishMission", "POST", dt);
                console.log(rq);
                rq.done((data,status,xhr)=>{
                    console.log(data,status,xhr);
                    close();
                    //if(status==200)
                })
                rq.fail((data,status,xhr)=>{
                })
                /*rq.error((err)=>{
                    console.error(data);
                })*/
            }, "Pubblica")
        })
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