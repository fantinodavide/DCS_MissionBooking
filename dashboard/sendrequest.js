function send_request(url,method,parameters,callback){
	//alert(JSON.stringify(parameters) + " - Method: " + method);
	$.ajax({
		url: url,
		type: method,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		dataType: "text",
		data: parameters,
		timeout : 10000,
		success: callback,
		error : function(jqXHR, test_status, str_error){
			console.error("Error: " + str_error);
		}
	});
}

function sendRequestNoCallback(url,method,parameters){
	return $.ajax({
        url: url, 
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		type: method,
		dataType: "json",
		data: parameters,
		timeout: 5000
	});
}

function error(jqXHR, testStatus, strError) {
	if (jqXHR.status == 0)
		console.error("server timeout");
	else if (jqXHR.status == 200)
		console.error("Formato dei dati non corretto : " + jqXHR.responseText);
	else
		console.error("Server Error: " + jqXHR.status + " - " + jqXHR.responseText);
}