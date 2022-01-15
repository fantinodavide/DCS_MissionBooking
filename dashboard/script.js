$(document).ready(()=>{
    send_request("/api/getAllMissions", "GET", null, (data) => {
        const jsonData = JSON.parse(data);
        for(let m of jsonData){
            let missionDate = new Date(m.missionInputData.MissionDateandTime)
            $("#missionSelection").append("<option value=\""+m._id+"\">"+toUpperFirstChar(m.missionInputData.MissionName)+": "+missionDate.toLocaleDateString("it-IT",{})+"</option>");
        }
        
        $("#missionSelection").on("change",(e)=>{
            const missionId = e.target.value;
            send_request("/api/getMissionDetails", "GET", {missionId:missionId}, (data) => {
                const jsonData = JSON.parse(data);
                console.table(jsonData.parsedMiz.blue);
            });
        })
    })
})