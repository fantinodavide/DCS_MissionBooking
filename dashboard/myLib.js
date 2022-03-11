$(document).ready(() => {
    send_request("/api/getAppName", "GET", null, (data) => {
        if (data != "") {
            $("#appName").html(data)
            $("title").html($("title").html() + " | " + data)
        }
    })
    send_request("/api/getMenuUrls", "GET", {}, (data) => {
        const jsonData = JSON.parse(data);
        console.log(jsonData);
        if (jsonData.status == "login_required") {
            $("#menuToggleContainer").remove();
        } else {
            for (let u of jsonData.sort((a, b) => { return a.order - b.order })) {
                let a = $("<a></a>");
                if (u.type == "redirect")
                    a.attr("href", u.url);
                else {
                    console.log("request");
                    switch (u.url) {
                        case "/api/logout":
                            a.on("click", logout)
                            break;

                        default:
                            a.on("click", () => {
                                send_request(u.url, "GET", {}, () => { })
                            })
                            break;
                    }
                }
                a.html(u.name);
                $("#menu").append(a);
            }
        }
    }, true)
    $("#menuToggleContainer").click((e) => {
        $("#menu").toggleClass("show");
        $("#menuToggleContainer").toggleClass("show");
    })
    getAppPersonalization();
})
function css_var(cssvar, cssval) {
    console.log("Setting " + cssvar + " to " + cssval);
    document.querySelector(':root').style.setProperty('--' + cssvar, cssval)
}
function getAppPersonalization(callback = null) {
    var appConfiguration;
    if (!appConfiguration) {
        send_request("/api/getAppPersonalization", "GET", null, (data) => {
            if (data != "") {
                const jsonData = JSON.parse(data);
                if (callback) callback(jsonData);
                appConfiguration = jsonData
                setFaviconFromUrl(jsonData.favicon)
                css_var('accentColor', jsonData.accentc_color)
            }
        })
    } else {
        if (callback) callback(appConfiguration);
    }
}

function setFaviconFromUrl(favImg) {
    let headTitle = document.querySelector('head');
    let setFavicon = document.createElement('link');
    setFavicon.setAttribute('rel', 'shortcut icon');
    setFavicon.setAttribute('href', favImg);
    headTitle.appendChild(setFavicon);
}
/*function setFaviconFromUrl(url) {
    let tmpImg = document.createElement("img");
    tmpImg.src = url;
    setFaviconFromImgElm(tmpImg)
    
}*/

function setFaviconFromImgElm(elm) {
    console.log("Setting favicon");
    window.favicon = new Favico({
        animation: 'popFade'
    });
    favicon.image(elm);
}

function inputPopup(title, campiTipi, callback, txtBtnConf = "Conferma", showAnnulla = true) {
    //if($(".inputPopup")[0]) return;
    if ($(".loginContainer")[0]) return;

    let hideBg = $("<div></div>");
    let loginContainer = $("<div></div>");
    let header = $("<h2>" + title + "</h2>");
    let btnContainer = $("<div></div>");
    let confBtn = $("<button>" + txtBtnConf + "</button>");
    let annullaBtn = $("<button>Annulla</button>");

    loginContainer.addClass("loginContainer");
    btnContainer.addClass("btnContainer");
    confBtn.addClass("loginBtn");
    annullaBtn.addClass("annullaBtn");
    hideBg.css({
        position: "fixed",
        top: "0",
        left: "0",
        height: "100%",
        width: "100%",
        background: "#0004",
        opacity: "0",
        transition: "all 150ms ease-in-out"
    })
    annullaBtn.on("click", function () {
        loginContainer.css("opacity", "0");
        hideBg.css("opacity", "0");
        setTimeout(function () {
            loginContainer.remove();
            hideBg.remove();
        }, 160)
    })
    confBtn.on("click", function () {
        //console.log("ConfBtn Pressed");
        //annullaBtn.trigger("click");
        //let arrCampi = [];
        let retJson = new Object;
        let canSend = true;
        for (let inp of loginContainer.find("input")) {
            if (inp.value.replace(" ", "") != "") {
                /*let tmp = new Object;
                tmp = {[inp.name]:inp.value};
                arrCampi.push(tmp)*/
                retJson[inp.name] = inp.value;
            } else {
                $(inp.parentNode).css("background", "#f77");
                canSend = false;
            }
            setTimeout(function () { $(inp.parentNode).css("background", "") }, 2000);
        }
        if (canSend) {
            let json = JSON.stringify(retJson);
            callback(json, getPointerCampo, close);
        }
    })

    $("body").on("keydown", function (e) {
        if (e.originalEvent.key == "Escape") {
            $(annullaBtn).trigger("click");
        }
    })
    loginContainer.append(header);
    for (let i = 0; i < campiTipi[0].length; i++) {
        let name = campiTipi[0][i];
        let type = campiTipi[1][i];

        let fieldset = $("<fieldset></fieldset>");
        let legend = $("<legend>" + toUpperFirstChar(name) + "</legend>");
        let input = $("<input name='" + name.replace(/\s/g, "") + "'>");

        input.attr("type", type);
        input.on("keydown", function (e) {
            if (e.originalEvent.key == "Enter") {
                $(confBtn).trigger("click");
            }
        })

        loginContainer.append(fieldset);
        fieldset.append(legend);
        fieldset.append(input);
    }

    if (showAnnulla) btnContainer.append(annullaBtn);
    btnContainer.append(confBtn);
    loginContainer.append(btnContainer);
    $("body").append(loginContainer);
    $("body").append(hideBg);
    setTimeout(function () {
        loginContainer.css("opacity", "1");
        hideBg.css("opacity", "1");
    }, 5)

    function close() {
        annullaBtn.trigger("click");
    }
    function getPointerCampo(campo) {
        return $("[name=" + campo + "]").parent();
    }
}
function inputPopupObjs(title, objs, callback, txtBtnConf = "Conferma", showAnnulla = true, closeCallback = null) {
    //if($(".inputPopup")[0]) return;
    if ($(".loginContainer")[0]) return;

    let hideBg = $("<div></div>");
    let loginContainer = $("<div></div>");
    let header = $("<h2>" + title + "</h2>");
    let btnContainer = $("<div></div>");
    let confBtn = $("<button>" + txtBtnConf + "</button>");
    let annullaBtn = $("<button>Annulla</button>");

    loginContainer.addClass("loginContainer");
    btnContainer.addClass("btnContainer");
    confBtn.addClass("loginBtn");
    annullaBtn.addClass("annullaBtn");
    hideBg.css({
        position: "fixed",
        top: "0",
        left: "0",
        height: "100%",
        width: "100%",
        background: "#0004",
        opacity: "0",
        transition: "all 150ms ease-in-out"
    })
    annullaBtn.on("click", close)
    confBtn.on("click", function () {
        let retJson = new Object;
        let canSend = true;
        for (let inp of loginContainer.find("input")) {
            if (inp.value.replace(" ", "") != "") {
                /*let tmp = new Object;
                tmp = {[inp.name]:inp.value};
                arrCampi.push(tmp)*/
                retJson[inp.name] = inp.value;
            } else {
                $(inp.parentNode).css("background", "#f77");
                canSend = false;
            }
            setTimeout(function () { $(inp.parentNode).css("background", "") }, 2000);
        }
        
        for (let opt of loginContainer.find(":selected")) {
            let indx = $(opt.parentNode).attr("name");
            
            if(!retJson[indx]) retJson[indx] = [];
            retJson[indx].push(opt.value);
            
            
        }
        if (canSend) {
            let json = JSON.stringify(retJson);
            callback(json, getPointerCampo, close);
        }
    })

    $("body").on("keydown", function (e) {
        if (e.originalEvent.key == "Escape") {
            $(annullaBtn).trigger("click");
        }
    })
    loginContainer.append(header);
    for (let o of objs) {
        let fieldset = $("<fieldset></fieldset>");
        let legend = $("<legend>" + toUpperFirstChar(o.title) + "</legend>");
        let input = $("<input>");
        if (o.elm) input = o.elm;
        if (o.name) input.attr("name", o.name.replace(/\s/g, ""))
        if (o.type) input.attr("type", o.type);
        input.on("keydown", function (e) {
            if (e.originalEvent.key == "Enter") {
                $(confBtn).trigger("click");
            }
        })

        if (!o.noFieldset) {
            fieldset.append(legend);
            fieldset.append(input);
            loginContainer.append(fieldset);
        } else {
            loginContainer.append(input);
        }
    }

    if (showAnnulla) btnContainer.append(annullaBtn);
    btnContainer.append(confBtn);
    loginContainer.append(btnContainer);
    $("body").append(loginContainer);
    $("body").append(hideBg);
    setTimeout(function () {
        loginContainer.css("opacity", "1");
        hideBg.css("opacity", "1");
    }, 5)

    function close() {
        loginContainer.css("opacity", "0");
        hideBg.css("opacity", "0");
        setTimeout(function () {
            loginContainer.remove();
            hideBg.remove();
        }, 160)
        if(closeCallback) closeCallback();
    }
    function getPointerCampo(campo) {
        return $("[name=" + campo + "]").parent();
    }
}

function toUpperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function logout() {
    send_request("/api/logout", "GET", null, (data) => {
        if (data == "logout_ok") {
            location.reload();
        }
    })
}
function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}