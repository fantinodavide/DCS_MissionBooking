const requestTestParseMission = false;
var socket;

$(document).ready(() => {
    console.log("Admin");

    $("#loadAirportsLua").click(() => {
        const inpObjs = [
            {
                title: "Airports LUA",
                name: "airports-lua",
                type: "file"
            }
        ]
        inputPopupObjs("Airports LUA", inpObjs, (jsonData, getPointerCampo, close) => {
            const fileData = getPointerCampo("airports-lua").find("input")[0];
            //console.log(jsonData, fileData.files[0], fileData.files[0].name);
            var formData = new FormData();

            formData.append("airports", fileData.files[0], fileData.files[0].name);
            formData.append("upload_file", true);

            $.ajax({
                type: "POST",
                url: "/api/admin/loadAirportsLua",
                // xhr: function () {
                //     var myXhr = $.ajaxSettings.xhr();
                //     if (myXhr.upload) {
                //         myXhr.upload.addEventListener('progress', that.progressHandling, false);
                //     }
                //     return myXhr;
                // },
                success: function (data) {
                    // your callback here
                    console.log(data)
                    close();
                },
                error: function (error) {
                    // handle error
                },
                async: true,
                data: formData,
                cache: false,
                contentType: false,
                processData: false,
                timeout: 60000
            });
        }, "Upload")
    })

    send_request("/api/admin/getAllAirports", "GET", null, (data) => {
        const parsedData = JSON.parse(data);
        console.log(parsedData);
        parsedData.forEach((val, key) => {
        });
    })
})