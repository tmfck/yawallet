// 410011900790456.A0BCC176FAD0F4C68F59BF4BCC1B08A9EA3FC53A80CFA6F759A6B9070B68C719E7C9F0108D625A3F051D2BB9EDD159542BD9AFD3203DB61211AF90A902BD2FD87B7C170695A258A47BF1936199F877D9503B348DD3B6109D0E9B7F64A6BAF2E1DE73CE5721B0FB833B5FCE158F38E90CD61EF6166508F695342BE84646E6D8C2

function Request(url, opts) {
  return new Promise((resolve, reject) => {
    opts = opts || {};
    let method = opts.method || 'GET';
    let xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (opts.headers) {
      for (let header in opts.headers) {
        xhr.setRequestHeader(header, opts.headers[header]);
      }
    }
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch (e) {
        resolve(xhr.responseText);
      }
    };
    xhr.onerror = () => {
      reject(xhr.responseText || '[ERROR]');
    };
    xhr.send();
  });
}

function parseLocationSearch() {
  let arr = window.location.search.replace(/^[?]/, '').split('=');
  let out = {};
  arr.forEach((item, index) => {
    if (index % 2) {
      out[arr[index - 1]].push(item);
    } else {
      out[item] = [];
    }
  });
  return out;
}

if (typeof CStorage !== 'function')
CStorage = class CStorage {
  constructor() {
    this.storage = localStorage;
  }
  get(key, def) {
    let out = this.storage.getItem(key);
    try {
      out = JSON.parse(out);
    } catch (e) {
      //
    }
    return out || def;
  }
  set(key, value) {
    this.storage.setItem(key, JSON.stringify(value));
  }
};
CStorage = new CStorage;

if (typeof List !== 'function')
List = class List {
  constructor() {
    this.storage = CStorage;
  }
  readAll() {
    return this.storage.get('tokens', {});
  }
  add(token) {
    let set = this.storage.get('tokens', {});
    if (typeof set[token] !== 'undefined') {
      return false;
    }
    set[token] = {name: "Новый кошелёк (" + token.split('.')[0] + ")"};
    this.storage.set('tokens', set);
    return true;
  }
  remove(token) {
    let tokens = this.storage.get('tokens', {});
    delete tokens[token];
    this.storage.set('tokens', tokens);
    return true;
  }
};
List = new List;

function updateBalance() {
  $('.list-group-flush').empty();
  let info = List.readAll();
  for (let token of Object.keys(info)) {
    let clone = $('#list-item').clone().appendTo('.list-group-flush')[0];
    $($(clone).find('.text-dark')[0]).attr('data-token', token).text(info[token].name);
    clone.hidden = false;
    Request('/api/account-info', {
      method: "POST",
      headers: {
        "Authentification": "Bearer " + token
      }
    }).then((res) => {
      if (!res.balance || res.error) {
        throw new Error();
      }
      $($(clone).find('.cash')[0]).text(res.balance + ' руб.');
    }).catch((err) => {
      $($(clone).find('.cash')[0]).text('Ошибка! (' + err + ')');
    })
  }
}
updateBalance();

let getParams = parseLocationSearch();
if (getParams.token && getParams.token[0]) {
  for (let token of getParams.token) {
    List.add(token);
  }
  window.location.search = '';
}

$('#btn__tokenSubmit').click(() => {
  let tokens = $('#form__import')[0].value;
  if (!tokens) {
    return;
  }
  try {
    tokens = JSON.parse(tokens);
    let out = {
      __proto__: List.readAll(),
    };
    for (let key of Object.keys(tokens)) {
      out[key] = tokens[key];
    }
    CStorage.set('tokens', out);
  } catch (e) {
    List.add(tokens);
  }
  updateBalance();
});
$('#btn__exportTokens').click(() => {
  let tokens = CStorage.get('tokens', {});
  let input = $('#input__tokens')[0];
  input.value = JSON.stringify(tokens);
  input.select();
  document.execCommand("copy");
});

(() => {
  $('.list-group-item .text-dark').click((e) => {
    e.target.hidden = true;
    let input = $(e.target).next()[0];
    let btn = $(input).next()[0];
    input.value = e.target.innerText;
    input.hidden = false;
    btn.hidden = false;
    $(input).focus();
    $(input).keypress((e) => {
      if (e.keyCode === 13) {
        $(btn).click();
      }
    });
    $(btn).click(() => {
      input.hidden = true;
      btn.hidden = true;
      e.target.hidden = false;
      if (!input.value || input.value === '') {
        input.value = e.target.dataset.token.split('.')[0];
      }
      e.target.innerText = input.value;
      let tokens = CStorage.get('tokens', {});
      if (tokens[e.target.dataset.token] && (input.value !== tokens[e.target.dataset.token].name)) {
        tokens[e.target.dataset.token].name = input.value;
        CStorage.set('tokens', tokens);
      }
      $(btn).unbind();
    })
  });
  $('.list-group-item .close').click((e) => {
    let parent = $(e.target).parent().parent()[0];
    List.remove($(parent).find('.text-dark')[0].dataset.token);
    $(parent).remove();
    $(e.target).unbind();
  });
})();