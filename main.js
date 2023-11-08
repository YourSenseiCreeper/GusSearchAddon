function prepareOptions(method, body, sid) {
  let options = {
    method: method,
    mode: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Origin": "https://wyszukiwarkaregon.stat.gov.pl",
      "Referer": "https://wyszukiwarkaregon.stat.gov.pl/appBIR/index.aspx",
      "Host": "wyszukiwarkaregon.stat.gov.pl"
    },
    body: body,
  };
  if (!!sid) {
    options.headers["sid"] = sid;
  }
  return options; 
}

function prepareSearchBody(query) {
  let fixedQuery = query.toLowerCase().replaceAll('-', '').replaceAll(' ', '').trim();
  let nip = fixedQuery.includes("nip:") ? fixedQuery.replace('nip:', '').trim() : null;
  let regon = fixedQuery.includes("regon:") ? fixedQuery.replace('regon:', '').trim() : null;
  // let krsy = fixedQuery.includes("krs:") ? [ fixedQuery.replace('krs:', '').trim() ] : null; // api throws exception
  let body = {
    pParametryWyszukiwania:
    {
      NazwaPodmiotu: null,
      NumerNieruchomosci: null,
      AdsSymbolGminy: null,
      AdsSymbolMiejscowosci: null,
      AdsSymbolPowiatu: null,
      AdsSymbolUlicy: null,
      AdsSymbolWojewodztwa: null,
      Dzialalnosci: null,
      PrzewazajacePKD: false,
      Regon: regon,
      Krs: null,
      Nip: nip,
      Regony9zn: null,
      Regony14zn: null,
      Krsy: null,
      Nipy: null,
      NumerwRejestrzeLubEwidencji: null,
      OrganRejestrowy: null,
      RodzajRejestru: null,
      FormaPrawna: null
    },
    jestWojPowGmnMiej: true
  }
  return JSON.stringify(body);
}

function preparePelnyRaportBody(regon, nazwaRaportu) {
  let body = {
    pRegon: regon,
    pNazwaRaportu: nazwaRaportu,
    pSilosID:"0"
  };
  return JSON.stringify(body);
}

function formatResponse(data) {
  return `
  ${data.praw_nazwa} \n
  NIP: ${data.praw_nip} \n 
  REGON: ${data.praw_regon14} \n
  Data powstania: ${data.praw_dataPowstania} \n
  Data wpisu do ewidencji: ${data.praw_dataWpisuDoRejestruEwidencji} \n
  Data rozpoczęcia działalności: ${data.praw_dataRozpoczeciaDzialalnosci} \n
  Siedziba: ${data.praw_adSiedzNazwaKraju}, woj. ${data.praw_adSiedzNazwaWojewodztwa}, miasto ${data.praw_adSiedzNazwaMiejscowosci} ${data.praw_adSiedzNazwaUlicy} ${data.praw_adSiedzNumerNieruchomosci}`;
}

searchInGus = function(word){
  // let getScriptOptions = prepareOptions("GET", null, null);
  // fetch('https://wyszukiwarkaregon.stat.gov.pl/appBIR/scripts/appBir220810o.js', getScriptOptions).then(r => r.text()).then(scriptResult => {
  //   console.log(scriptResult);
  //   let evaluatedScript = eval(scriptResult);
  //   let klucz = evaluatedScript._kluczuzytkownika;
  // });

  var query = word.selectionText;
  var getEndpointScriptOptions = prepareOptions('GET', null, null);
  fetch('https://wyszukiwarkaregon.stat.gov.pl/appBIR/scripts/appBirEv.js', getEndpointScriptOptions)
  .then(r => r.text()).then(scriptResponse => {
    let baseUrl = scriptResponse.match('\"(.+)\"')[1];

    // if key will be expired do:
    // 1. Go to https://wyszukiwarkaregon.stat.gov.pl
    // 2. Go to Sources > scripts > appBir220810o.js
    // 3. CTRL + F "klucz"
    // 4. Breakpoint
    // 5. Reload page
    // 6. Get _kluczuzytkownika value
    // 7. Paste here
    var zalogujOptions = prepareOptions('POST', '{"pKluczUzytkownika":"SV9)N#B#^B%63BE*p8^9"}', null);
    fetch(`${baseUrl}/Zaloguj`, zalogujOptions)
    .catch(r => console.log(r))
    .then(r => r.text()).then(result => {
      let parsedResponse = JSON.parse(result);
      if (parsedResponse.d === "") {
        chrome.tabs.getSelected(null, function(tab) {
          alert("Problem z kluczem użytkownika. Pobierz go manualnie z https://wyszukiwarkaregon.stat.gov.pl");
        });
        return;
      }

      let daneSzukajOptions = prepareOptions("POST", prepareSearchBody(query), parsedResponse.d);
      fetch(`${baseUrl}/daneSzukaj`, daneSzukajOptions)
      .then(r => r.text()).then(searchResult => {
        let parsedSearchResponse = JSON.parse(searchResult);
        let parsedD = JSON.parse(parsedSearchResponse.d);
        let regon = parsedD[0].Regon;

        let danePobierzPelnyRaportOptions = prepareOptions("POST", preparePelnyRaportBody(regon, 'DaneRaportPrawnaPubl'), parsedResponse.d);
        fetch(`${baseUrl}/DanePobierzPelnyRaport`, danePobierzPelnyRaportOptions)
        .then(r => r.text()).then(fullReportResult => {
          let parsedFullReportResult = JSON.parse(fullReportResult);
          let parsedFullD = JSON.parse(parsedFullReportResult.d);
          chrome.tabs.getSelected(null, function(tab) {
            alert(formatResponse(parsedFullD[0]));
          });
        })
      });
    });
  });
};

//test
// searchInGus({ selectionText: "NIP: 879 016 90 21" });
// searchInGus({ selectionText: "REGON: 001323202" });
// searchInGus({ selectionText: "KRS: 0000156394" });

chrome.contextMenus.create({
  title: "Znajdz w GUS po REGON lub NIP",
  contexts:["selection"],  // ContextType
  onclick: searchInGus // A callback function
 });

// klucz zmienia się codziennie
// "SV9)N#B#^B%63BE*p8^9"
// "4&W$U)3HD4EY$@)_dU&_"