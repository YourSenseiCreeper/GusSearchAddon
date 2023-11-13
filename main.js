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

async function fetchData(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Request '${url}' returned HTTP error! status: ${response.status}`);
    }
    const responseText = await response.text();
    return responseText;
  } catch (e) {
    console.log(e);
  }
}

async function searchInGusWrapper(word, userKey) {
  var query = word.selectionText;
  var getEndpointScriptOptions = prepareOptions('GET', null, null);
  var scriptResponse = await fetchData('https://wyszukiwarkaregon.stat.gov.pl/appBIR/scripts/appBirEv.js', getEndpointScriptOptions);
  let baseUrl = scriptResponse.match('\"(.+)\"')[1];

  var zalogujOptions = prepareOptions('POST', `{"pKluczUzytkownika":"${userKey}"}`, null);
  let zalogujResponse = await fetchData(`${baseUrl}/Zaloguj`, zalogujOptions);
  let parsedZalogujResponse = JSON.parse(zalogujResponse);
  if (parsedZalogujResponse.d === "") {
    chrome.tabs.getSelected(null, function(tab) {
      alert("Problem z kluczem użytkownika. Pobierz go manualnie z https://wyszukiwarkaregon.stat.gov.pl");
    });
    return;
  }
  let sessionToken = parsedZalogujResponse.d;

  let daneSzukajOptions = prepareOptions("POST", prepareSearchBody(query), sessionToken);
  let daneSzukajResponse = await fetchData(`${baseUrl}/daneSzukaj`, daneSzukajOptions);
  let parsedSearchResponse = JSON.parse(daneSzukajResponse);
  let parsedD = JSON.parse(parsedSearchResponse.d);
  let regon = parsedD[0].Regon;

  let danePobierzPelnyRaportOptions = prepareOptions("POST", preparePelnyRaportBody(regon, 'DaneRaportPrawnaPubl'), sessionToken);
  let danePobierzPelnyRaportResponse = await fetchData(`${baseUrl}/DanePobierzPelnyRaport`, danePobierzPelnyRaportOptions);
  let parsedFullReportResult = JSON.parse(danePobierzPelnyRaportResponse);
  let parsedFullD = JSON.parse(parsedFullReportResult.d);
  chrome.tabs.getSelected(null, function(tab) {
    alert(formatResponse(parsedFullD[0]));
  });
}

searchInGus = function(word){
  let userKey = '4R*5$X9M4Z35N6%XuX^K';
  searchInGusWrapper(word, userKey).then(_ => console.log('finished'));
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