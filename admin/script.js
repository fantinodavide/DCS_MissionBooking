$(document).ready(() => {
    console.log("Admin");

    send_request("/api/admin/getAllMissionFiles","GET",null,(data)=>{
        const parsedData = JSON.parse(data);
        console.log(parsedData);
        parsedData.forEach((val,key) => {
            console.log(val,key);
            $("#missionSelection").append("<option>"+val.missionName+"</option>")
        });
    })
})