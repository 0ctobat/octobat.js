var OctobatJS, activate, makeAPICall, isIE, sendEvent, debug, encodeURI, parseJSON, validatePlan, validateCharge, validateCoupon, bindChangeEvents, bindOctobatForm, getGatewayPkeyAPICall, calculateTaxAPICall, getCustomerIPAddress, getCustomerBankCountry, fillBindedFields, getDiscount, chargeCustomer, validateFormElements, validateEmail, serializeForm, bindFormIsDisplayable, bindFormIsSubmittable;

makeAPICall = function(url, method, headers, async, payload, api_key, callback) {
  headers['Authorization'] = "Basic " + btoa(api_key + ":");
      
  return makeHTTPCall(url, method, headers, async, payload, callback);
}

makeHTTPCall = function(url, method, headers, async, payload, callback) {
      
  if (callback == null)
    callback = {};
  
  var request;
  request = new XMLHttpRequest;
  
  request.onreadystatechange = function() {
    var e, a, r;
    if (request.readyState === 4) {
      a = parseJSON(request.responseText) || request.responseText;
      if (request.status >= 200 && request.status < 300) {
        (r = callback.success || debug)(request.status, a);
      }
      else {
        request.status >= 300 && (e = callback.error || debug)(request.status, a)
      }
      return void 0 !== callback.complete && callback.complete(request.status, a);
    }
    else {
      return void 0;
    }
  }
  
  if (method === "POST") {
    request.open(method, url, async);
    request.setRequestHeader("Access-Control-Allow-Origin", "true");
    request.setRequestHeader("Content-Type", "application/json");
  }
  
  else {
    if (payload !== null) {
      url += encodeURI(JSON.parse(payload));
      payload = null;
    }
    request.open(method, url, async);
  }
  
  for (var key in headers) {
    request.setRequestHeader(key, headers[key]);
  }
  
  return request.send(payload);
  
}

debug = function(e, t) {
  return console.log(t), alert(t.message || JSON.stringify(t))
}

encodeURI = function(e) {
  return "?" + Object.keys(e).reduce(function(t, a) {
      return t.push(a + "=" + encodeURIComponent(e[a])), t
  }, []).join("&")
}

parseJSON = function(e) {
  var t, a;
  try {
      a = JSON.parse(e)
  } catch (r) {
      return t = r, !1
  }
  return a
}

isIE = function() {
  var ua = window.navigator.userAgent;
  var isIE = ua.indexOf("MSIE ");
  return isIE > 0 || navigator.userAgent.match(/Trident.*rv\:11\./) ? true : false
}

sendEvent = function(e, t) {
  var octobat_event, form;
  form = document.querySelector(Octobat.form_selector);
  
  if (void 0 !== window.jQuery) {
    octobat_event = jQuery.Event(e);
    octobat_event.detail = t;
    return $(form).trigger(octobat_event);
  }
  else {
    if (isIE()) {
      octobat_event = document.createEvent("CustomEvent");
      octobat_event.initCustomEvent(e, !0, !0, t);
    }
    else {
      octobat_event = new CustomEvent(e, {
        detail: t,
        bubbles: !0,
        cancelable: !0
      });
    }    
    return form.dispatchEvent(octobat_event);
  }
}

getBindedValue = function(field) {
  var v;
  v = document.querySelector("[data-octobat='" + field + "']");
  return v !== null ? v.value || "" : "";
}

fillBindedFields = function(classname, value) {
  var a, r;
  if (a = document.querySelectorAll("." + classname), a.length > 0) {
      for (r = 0; r < a.length;) a[r].innerHTML = value, r++;
  }
}


validatePlan = function(request_identifier) {
  var f = document.querySelector(Octobat.form_selector);
  var octobat_gateway = "stripe"; // data-gateway
  var octobat_pkey = f.getAttribute("data-octobat-pkey");
  var plan_id = f.getAttribute("data-plan");
  var params = JSON.stringify({gateway: octobat_gateway});
  
  return makeAPICall(Octobat.serverHost() + '/plans/' + plan_id, 'GET', {}, true, params, octobat_pkey, {
    success: function(e, data) {
      var f = document.querySelector(Octobat.form_selector);
      f.setAttribute("data-amount", data.plan.amount);
      f.setAttribute("data-currency", data.plan.currency);
      Octobat.setPlan(data.plan);
      calculateTaxAPICall({}, true, true, request_identifier);        
    },
    error: function(e, data) {
      sendEvent("octobat.form.init.failed", {message: data.message});
      console.log(data.error.message);
    }
  });
}

validateCharge = function(request_identifier) {
  var f = document.querySelector(Octobat.form_selector);
  var octobat_pkey = f.getAttribute("data-octobat-pkey");
  var jwt = f.getAttribute("data-charge");
  var params = JSON.stringify({charge: jwt});
  
  return makeAPICall(Octobat.serverHost() + '/charges/encoded_information', 'POST', {}, true, params, octobat_pkey, {
    success: function(e, data) {
      var f = document.querySelector(Octobat.form_selector);
      f.setAttribute("data-amount", data.amount);
      f.setAttribute("data-currency", data.currency);
      calculateTaxAPICall({}, true, true, request_identifier);
    },
    error: function(e, data) {
      sendEvent("octobat.form.init.failed", {message: data.message});
      console.log(data.error.message);
    }
  });
}

validateCoupon = function() {
  var f = document.querySelector(Octobat.form_selector);
  var octobat_pkey = f.getAttribute("data-octobat-pkey");
  var coupon = getBindedValue("coupon");
  var recurring;
  
  if (f.getAttribute("data-plan") != null && f.getAttribute("data-plan") != void 0) {
   recurring = true;
  }
  else {
    recurring = false;
  }
      
  if (coupon != "") {
    makeAPICall(Octobat.serverHost() + '/coupons/' + coupon + '?recurring=' + recurring, 'GET', {}, true, null, octobat_pkey, {
      success: function(e, data) {
        
        // Manage coupon
        Octobat.setCoupon(data.coupon);
        
        // Display coupon
        sendEvent("octobat.form.coupon.valid", {coupon: data.coupon, message: "Coupon is valid"});
        fillBindedFields('octobat-coupon-check', "OK");
        calculateTaxAPICall();
      },
      error: function(e, data) {
        fillBindedFields('octobat-coupon-check', "Invalid or expired coupon");
        sendEvent("octobat.form.coupon.invalid", {message: "Invalid or expired coupon"});
        Octobat.setCoupon(null);
        calculateTaxAPICall();
        console.log(data.error.message);
      }
    });
  }
  else {
    fillBindedFields('octobat-coupon-check', "");
    Octobat.setCoupon(null);
    calculateTaxAPICall();
  }
  
  
}

getCustomerIPAddress = function() {  
  makeHTTPCall("https://checkout-form.herokuapp.com/ip.json", 'GET', null, true, null, {
    success: function(e, data) {
      Octobat.setCustomerIP(data.query);
      Octobat.setCustomerIPCountry(data.countryCode);
      setSelectedCountry();
    },
    error: function(e, data) {
      Octobat.setMossCompliance(false);
      console.log(data);
    }
  });
}



getCustomerBankCountry = function() {  
  if (document.querySelector("[data-octobat='number']") !== null) {
    document.querySelector("[data-octobat='number']").addEventListener('change', function() {
      card_number = getBindedValue('number').replace(/\D/g, '');
      if (card_number.length >= 6) {
        bincode = card_number.substring(0,6);
        makeHTTPCall("https://www.binlist.net/json/" + bincode, 'GET', null, true, null, {
          success: function(e, data) {
            console.log(data);
            Octobat.setCustomerBankCountry(data.country_code);
            setSelectedCountry();
          },
          error: function(e, data) {
            Octobat.setMossCompliance(false);
            console.log(data);
          }
        });
      }
    });
  }
  else {
    Octobat.setMossCompliance(false);
  }
}

setSelectedCountry = function() {
  
  if (Octobat.mossCompliance() === true) {
    if (getBindedValue('country') == Octobat.customerBankCountry() || getBindedValue('country') == Octobat.customerIPCountry()) {
      Octobat.setSelectedCustomerCountry(getBindedValue('country'));
    }
    else if (Octobat.customerBankCountry() == Octobat.customerIPCountry() && Octobat.customerBankCountry() !== null) {
      Octobat.setSelectedCustomerCountry(Octobat.customerBankCountry());
    }
    else if (getBindedValue('country') !== null) {
      Octobat.setSelectedCustomerCountry(getBindedValue('country'));
    }
    else {
      Octobat.setSelectedCustomerCountry(customerIPCountry());
    }
  }
  else {
    if (getBindedValue('country') !== null) {
      Octobat.setSelectedCustomerCountry(getBindedValue('country'));
    }
    else {
      Octobat.setSelectedCustomerCountry(customerIPCountry());
    }
  }
}

bindChangeEvents = function() {
  var f = document.querySelector(Octobat.form_selector);
  if (f !== null) {
    if (document.querySelector("[data-octobat='coupon']") !== null) {
      document.querySelector("[data-octobat='coupon']").addEventListener('change', validateCoupon);
    }
    if (document.querySelector("[data-octobat='country']") !== null) {
      document.querySelector("[data-octobat='country']").addEventListener('change', calculateTaxAPICall);
    }
    if (document.querySelector("[data-octobat='zip-code']") !== null) {
      document.querySelector("[data-octobat='zip-code']").addEventListener('change', calculateTaxAPICall);
    }
    if (document.querySelector("[data-octobat='tax-number']") !== null) {
      document.querySelector("[data-octobat='tax-number']").addEventListener('change', calculateTaxAPICall);
    }
    if (document.querySelector("[data-octobat='number']") !== null) {
      document.querySelector("[data-octobat='number']").addEventListener('change', calculateTaxAPICall);
    }
  }
}

bindOctobatForm = function() {
  var f = document.querySelector(Octobat.form_selector);
  if (f !== null) {
    bindFormIsDisplayable();
    bindFormIsSubmittable();
    
    if (f.getAttribute("data-moss-compliance") !== null && f.getAttribute("data-moss-compliance") == "true") {
      Octobat.setMossCompliance(true);
      getCustomerIPAddress();
      getCustomerBankCountry();
    }
    
    if (f.getAttribute("data-plan") !== null)
      validatePlan(Octobat.requestIdentifier());
      
    if (f.getAttribute("data-charge") !== null)
      validateCharge(Octobat.requestIdentifier());
      
    getGatewayPkeyAPICall();
    bindChangeEvents();
  }
}

bindFormIsDisplayable = function() {
  if (void 0 !== window.jQuery) {
    $(Octobat.form_selector).on('octobat.form.init.complete', function(data) {
      Octobat.setFormIsDisplayable(true);
    });
  }
  else {
    var f = document.querySelector(Octobat.form_selector);
    f.addEventListener("octobat.form.init.complete", function(data) {
      Octobat.setFormIsDisplayable(true);
    });
  }
  
}

bindFormIsSubmittable = function() {
  if (void 0 !== window.jQuery) {
    $(Octobat.form_selector).on('octobat.form.gateway_pkey.retrieved', function(data) {
      Octobat.setFormIsSubmittable(true); 
    });
  }
  else {
    var f = document.querySelector(Octobat.form_selector);
    f.addEventListener("octobat.form.gateway_pkey.retrieved", function(data) {
      Octobat.setFormIsSubmittable(true); 
    });
  }
}


getGatewayPkeyAPICall = function(async) {
  if (async == null)
    async = true;
    
  var f = document.querySelector(Octobat.form_selector);
  var octobat_gateway = "stripe"; // data-gateway
  var octobat_pkey = f.getAttribute("data-octobat-pkey"); // data-gateway
  var using_checkout = Octobat.form_selector === '#octobat-checkout-form' ? true : false;
  var params = JSON.stringify({gateway: octobat_gateway, js_version: Octobat.getVersion(), using_checkout: using_checkout});
  
  return makeAPICall(Octobat.serverHost() + '/tokens/gateway_pkey', 'GET', {}, async, params, octobat_pkey, {
    success: function(e, t) {
      var f = document.querySelector(Octobat.form_selector);
      f.setAttribute("data-gateway-pkey", t.gateway_pkey);
      Octobat.setAuthToken(t.token);
      sendEvent("octobat.form.gateway_pkey.retrieved", {message: "Gateway PKey retrieved"});
    },
    error: function(e, data) {
      sendEvent("octobat.form.gateway_pkey.error", {message: data.message});
      console.log(data.message);
    }
  });
}

calculateTaxAPICall = function(handler, async, just_completed, request_identifier) {
  
  if (just_completed == null) {
    just_completed = false;
  }
      
  setSelectedCountry();
  if (handler == null)
    handler = {};
    
  if (async == null)
    async = true;
    
  var f = document.querySelector(Octobat.form_selector);
  var octobat_gateway = "stripe"; // data-gateway
  var octobat_pkey = f.getAttribute("data-octobat-pkey");
  var params = JSON.stringify({
    validate_tax_number: f.getAttribute("data-validate-tax-number") || false,
    transaction_type: f.getAttribute("data-transaction-type") || "eservice",
    customer_country: Octobat.selectedCustomerCountry(),
    customer_zip_code: getBindedValue('zip-code'),
    customer_tax_number: getBindedValue('tax-number')
  });
  
  return makeAPICall(Octobat.serverHost() + '/taxes', 'GET', {}, async, params, octobat_pkey, {
    success: function(e, data) {
      var extratax, tax, total;
      
      if (just_completed === true) {
        sendEvent("octobat.form.init.complete", {request_identifier: request_identifier});
      }
      
      Octobat.setTaxes(data);
      Octobat.setTransaction(data.transaction);
      
      if (data.transaction.tax_id_validity != null && data.transaction.tax_id_validity == false) {
        sendEvent("octobat.tax.calculation.done", {tax: data, warning: true, message: "Invalid tax ID"});
        Octobat.setValidTaxID(false);
      }
      else {
        sendEvent("octobat.tax.calculation.done", {tax: data, warning: false});
        if (Octobat.getValidTaxID() != null && Octobat.getValidTaxID() == false) {
          Octobat.setValidTaxID(null);
        }
      }
      
      // Handle taxes
      
      
      
      if (Octobat.formIsDisplayable() || just_completed === true) {
        var f = document.querySelector(Octobat.form_selector);

        tax_included = f.getAttribute("data-taxes") || "excluded";
        amount = f.getAttribute("data-amount");
        
        quantity = parseInt(f.getAttribute("data-quantity")) || 1;

        // If tax is excluded from initial amount
        if (tax_included == "excluded") {
          t = parseFloat(data.total || 0);
          extratax = parseInt(amount) * quantity;
          discount = getDiscount(extratax);
          net = extratax - discount;
          tax = Math.round((parseInt(amount) * quantity - discount) * t / 100);
          total = extratax - discount + tax;
        }
        // If tax is included from initial amount
        else {
          t = parseFloat(data.total || 0);
          if (t > 0) {
            t_discount = getDiscount(parseInt(amount) * quantity);
            discount = Math.round(t_discount / (1 + t / 100));
            extratax = Math.round(parseInt(amount) * quantity / (1 + t / 100));
            net = extratax - discount;
            tax = Math.round((net) * t / 100)
            total = parseInt(amount) * quantity - t_discount;
          }
          else {
            extratax = parseInt(amount) * quantity;
            discount = getDiscount(extratax);
            net = extratax - discount;
            tax = 0;
            total = extratax - discount;
          }
        }

        console.log(extratax);
        console.log(discount);
        console.log(net);
        console.log(tax);
        console.log(total);

        fillBindedFields('octobat-net', (net / 100).toFixed(2));
        fillBindedFields('octobat-discount', (discount / 100).toFixed(2));
        fillBindedFields('octobat-extratax', (extratax / 100).toFixed(2));
        fillBindedFields('octobat-taxes', (tax / 100).toFixed(2));
        fillBindedFields('octobat-total', (total / 100).toFixed(2));
      }
      
    },
    error: function(e, data) {
      handler.complete !== void 0 ? handler.complete(e, data) : (handler.error || debug)(e, a);
    }
  });
}

getDiscount = function(extratax) {
  if (Octobat.getCoupon() === null) {
    return 0;
  }
  else {
    var c = Octobat.getCoupon();
    if (c.amount_off === null) {
      return Math.round(extratax * (c.percent_off / 100));
    }
    else {
      return c.amount_off;
    }
  }
}

chargeCustomer = function(gateway, charge_type, handler) {
      
  var data_element, form_validation, error_callback, params;
  var f = document.querySelector(Octobat.form_selector);
  var octobat_pkey = f.getAttribute("data-octobat-pkey");
  
  if (gateway == null)
    gateway = "stripe";
  
  if (handler == null)
    handler = {};
  
  // Validate form data before submitting
  data_element = charge_type === "subscriptions" ? "plan" : "charge";
  
  // URL
  var api_call_url = charge_type === "charges" ? "charges" : "subscriptions";
  
  if (form_validation = validateFormElements(data_element), form_validation === true) {
    // Calculate definitive tax (must be synchronous)
    calculateTaxAPICall({}, false);
    
    // Serialize form
    params = serializeForm(charge_type);
    
    // Make API calls properly
    headers = {'JWT': Octobat.authToken()};
    makeAPICall(Octobat.serverHost() + '/' + api_call_url, 'POST', headers, true, params, octobat_pkey, handler);
    
  }
  else {
    error_callback = handler.error || debug;
    handler.complete !== void 0 && handler.complete(422, {message: form_validation});
    return error_callback(422, {message: form_validation});
  }
}

validateFormElements = function(data_element) {
  var f = document.querySelector(Octobat.form_selector);
  var element = f.getAttribute("data-" + data_element);
  
  if (element === void 0 || element === "") {
    return "You must provide a value for data-" + data_element;
  }
  else if (getBindedValue("email") === "" || !validateEmail(getBindedValue("email"))) {
    return "Invalid email";
  }
  else if (getBindedValue("country") === "") {
    return "Country must be provided";
  }
  else {
    return true;
  }
}

validateEmail = function(email) {
  var exp = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return exp.test(email);
}

serializeForm = function(charge_type) {
  var params, gateway, f, business_type;
  
  if (charge_type == null)
    charge_type = "subscriptions";
  
  f = document.querySelector(Octobat.form_selector);
  var validate_tax_number = f.getAttribute("data-validate-tax-number") || false
  var tax_included = f.getAttribute("data-taxes") || "excluded";
  var existing_customer_id = f.getAttribute("data-customer-id") || null;
  
  gateway = "stripe";
  params = {};
  
  params.customer = {
    name: getBindedValue("name"),
    email: getBindedValue("email"),
    street_line_1: getBindedValue("street-line-1"),
    street_line_2: getBindedValue("street-line-2"),
    city: getBindedValue("city"),
    zip_code: getBindedValue("zip-code"),
    state: getBindedValue("state"),
    country: getBindedValue("country")
  };
  
  if (validate_tax_number && Octobat.getValidTaxID() != null && Octobat.getValidTaxID() == false) {
    params.customer.tax_number = null;
    business_type = 'B2C';
  }
  else {
    params.customer.tax_number = getBindedValue("tax-number") === "" ? null : getBindedValue("tax-number");
    business_type = getBindedValue("tax-number") === "" ? 'B2C' : 'B2B';
  }
  
  
  if (existing_customer_id != null) {
    params.customer.customer_id = existing_customer_id;
  }
  
  params.customer.card = getBindedValue("cardToken");
  params.customer.business_type = business_type;
  
  
  
  if (charge_type == "subscriptions") {
    params.subscription = {
      plan: f.getAttribute("data-plan"),
      quantity: parseInt(f.getAttribute("data-quantity")) || parseInt(1),
      tax_percent: "excluded" === tax_included ? Octobat.getTaxes().total : null,
      transaction_type: f.getAttribute("data-transaction-type") || "eservice",
      metadata: {
        tax_included: f.getAttribute("data-taxes") || "excluded",
        taxes: Octobat.getTaxes()
      }
    };
    
    if (Octobat.getCoupon() != null) {
      params.subscription.coupon = Octobat.getCoupon().id;
    }
    
    if (Octobat.mossCompliance() === true) {
      params.subscription.metadata.evidence = {
        customer_ip: Octobat.customerIP(),
        customer_billing_country: getBindedValue("country"),
        customer_ip_country: Octobat.customerIPCountry(),
        customer_bank_country: Octobat.customerBankCountry(),
        customer_selected_country: Octobat.selectedCustomerCountry()
      };
    }
    
  }
  else {
    params.charge = {
      charge: f.getAttribute("data-charge"),
      tax_percent: "excluded" === f.getAttribute("data-taxes") ? Octobat.getTaxes().total : null,
      transaction_type: f.getAttribute("data-transaction-type") || "eservice",
      metadata: {
        tax_included: f.getAttribute("data-taxes") || "excluded",
        taxes: Octobat.getTaxes()
      }
    };
    
    if (Octobat.mossCompliance() === true) {
      params.charge.metadata.evidence = {
        customer_ip: Octobat.customerIP(),
        customer_billing_country: getBindedValue("country"),
        customer_ip_country: Octobat.customerIPCountry(),
        customer_bank_country: Octobat.customerBankCountry(),
        customer_selected_country: Octobat.selectedCustomerCountry()
      };
    }
    
    if (Octobat.getCoupon() != null) {
      params.charge.coupon = Octobat.getCoupon().id;
    }
    
  }
  
  return JSON.stringify(params);
}


var OctobatJS = function() {
  this.form_is_submittable = false;
  this.form_is_displayable = false;
  this.request_identifier = null;
  this.taxes = {},
  this.transaction = {},
  this.server_host = 'https://apiv1.octobat.com',
  this.auth_token = null,
  this.form_selector = '#octobat-payment-form',
  this.moss_compliance = false,
  this.customer_ip = null,
  this.customer_ip_country = null,
  this.customer_bank_country = null,
  this.selected_customer_country = null,
  this.valid_tax_id = null,
  this.coupon = null,
  this.plan = null,
  this.version = "1.0.0"
}



OctobatJS.prototype = {
  
  init: function(e) {
    return 1 === document.querySelectorAll(e).length ? (this.form_selector = e, bindOctobatForm(), !0) : !1
  },
  formSelector: function() {
    return this.form_selector;
  },
  setFormSelector: function(e) {
    return this.form_selector = e;
  },
  requestIdentifier: function() {
    return this.request_identifier;
  },
  setRequestIdentifier: function(e) {
    return this.request_identifier = e;
  },
  formIsSubmittable: function() {
    return this.form_is_submittable;
  },
  formIsDisplayable: function() {
    return this.form_is_displayable;
  },
  setFormIsSubmittable: function(e) {
    return this.form_is_submittable = e;
  },
  setFormIsDisplayable: function(e) {
    return this.form_is_displayable = e;
  },
  authToken: function() {
    return this.auth_token;
  },
  setAuthToken: function(e) {
    return this.auth_token = e;
  },
  mossCompliance: function() {
    return this.moss_compliance;
  },
  setMossCompliance: function(e) {
    return this.moss_compliance = e;
  },
  customerIP: function() {
    return this.customer_ip;
  },
  setCustomerIP: function(e) {
    return this.customer_ip = e;
  },
  customerIPCountry: function() {
    return this.customer_ip_country;
  },
  setCustomerIPCountry: function(e) {
    return this.customer_ip_country = e;
  },
  customerBankCountry: function() {
    return this.customer_bank_country;
  },
  setCustomerBankCountry: function(e) {
    return this.customer_bank_country = e;
  },
  selectedCustomerCountry: function() {
    return this.selected_customer_country;
  },
  setSelectedCustomerCountry: function(e) {
    return this.selected_customer_country = e;
  },
  serverHost: function() {
    return this.server_host;
  },
  getTaxes: function() {
    return this.taxes;
  },
  setTaxes: function(e) {
    return this.taxes = e;
  },
  getTransaction: function() {
    return this.transaction;
  },
  setTransaction: function(e) {
    return this.transaction = e;
  },
  getValidTaxID: function() {
    return this.valid_tax_id;
  },
  setValidTaxID: function(e) {
    return this.valid_tax_id = e;
  },
  calculateTaxes: function(handler) {
    if (handler == null)
      handler = {};
    calculateTaxAPICall(handler);
  },
  createSubscription: function(handler) {
    var gateway = "stripe";
    
    if (handler == null)
      handler = {};
      
    return chargeCustomer("stripe", "subscriptions", handler);
  },
  createCharge: function(handler) {
    var gateway = "stripe";
    
    if (handler == null)
      handler = {};
    
    return chargeCustomer("stripe", "charges", handler);
  },
  refreshGatewayPKey: function() {
    return getGatewayPkeyAPICall(false);
  },
  refreshCoupon: function() {
    return validateCoupon();
  },
  getCoupon: function() {
    return this.coupon;
  },
  setCoupon: function(e) {
    return this.coupon = e;
  },
  getPlan: function() {
    return this.plan;
  },
  setPlan: function(e) {
    return this.plan = e;
  },
  getVersion: function() {
    return this.version;
  }
  
  
}

window.onload ? (v = window.onload, x = function() {
     v(), bindOctobatForm()
 }, window.onload = x) : window.onload = bindOctobatForm

module.exports = new OctobatJS();




