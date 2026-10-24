var searchClick = function () {
    var searchVal = document.querySelector('.search-input-value').value;
    if (searchVal) {
        window.location.href = '/so/' + searchVal
    } else {
        window.location.href = '/so'
    }
}
var randomOneWord = function (arr) {
    if (!arr || arr.length == 0) return "";
    return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
}
let imgDom = document.querySelector('.seo-biying-images img')
document.querySelectorAll('.seo-biying-images a').forEach((item) => {
    let urlimg = item.getAttribute("data-img")
    urlimg.innerHTML = `<img src="" >`
})
if (imgDom) {
    let urlimg = imgDom.getAttribute("src")
    document.body.style['background-image'] = `url(${urlimg})`
}
let imgLogoDom = document.querySelector('.logo img')
let randomWordNumList = [2,3,4,6,8,10]
if (document.title) {
    var asDom = ''
    var arrays = []
    var titlefullText = imgLogoDom.getAttribute("alt")
    if (titlefullText && titlefullText.length > 0) {
        let strc = titlefullText.replace(/《|》/g, '')
        strc = strc.replace(/\s|-|_|，/g, ',')
        var arraysQ1 = strc.split(',')
        if (arraysQ1 && arraysQ1.length > 0) {
            arraysQ1.forEach((item, index) => {
                if (item) {
                    arrays.push(item)
                }
            })
        }
    }

    if (arraysObject && arraysObject.s && arraysObject.s.length > 0) {
        arrays = arraysObject.s
    } else if (arraysObject.q) {
        var arraysQ = arraysObject.q.split('')
        var randomWordNum = randomOneWord(randomWordNumList)
        let txt = ''
        arraysQ.forEach((item, index) => {
            txt += item
            if (((index+1) % randomWordNum == 0 && index > 0)||index==arraysQ.length-1) {
                arrays.push(txt)
                txt = ''
            }
        })
    }
    arrays.forEach((item) => {
        asDom += `<a href="/so/${item}.html" onclick="openbaidu(this)">${item}</a><a class="hidden" href="/so/${item}" onclick="openbaidu(this)">${item}</a>`
    })
    let navBot = document.querySelector('.nav-bot-word')
    navBot.innerHTML = asDom
}
var openbaidu = function (that) {
    let searchTitle = that.innerText
    window.open('https://baidu.com/s?wd=' + searchTitle)
}