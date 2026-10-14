/* Shared behavior for the Spanish and English landing pages. */
  window.TURNOS = {
    whatsapp: "5493794721825",
    pixelId: "",
    posthog: {
      key: "phc_szMwRyawUvWLvfjUexFtRU7fzkifag2jetS86kMLrheB",
      host: "https://us.i.posthog.com"
    }
  };

  (function () {
    var id = window.TURNOS && window.TURNOS.pixelId;
    if (!id) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id);
    fbq('track', 'PageView');
  })();

  (function () {
    var ph = window.TURNOS && window.TURNOS.posthog;
    if (!ph || !ph.key) return;
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(ph.key, {
      api_host: ph.host || "https://us.i.posthog.com",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "identified_only"
    });
  })();

(function () {
  var english = document.documentElement.lang === "en";
  var cfg = window.TURNOS || {};

  // Preserve the section when switching languages, including without client storage.
  document.querySelectorAll("[data-language-link]").forEach(function (link) {
    link.addEventListener("click", function () {
      var url = new URL(link.href);
      url.hash = window.location.hash;
      link.href = url.href;
    });
  });
  var numero = String(cfg.whatsapp || "").replace(/\D/g, "");

  // Links de WhatsApp: número + mensaje precargado, evento "Contact" para Meta
  // y "whatsapp_click" para PostHog (con el botón en "boton").
  document.querySelectorAll("[data-wa]").forEach(function (a) {
    var msg = a.getAttribute("data-wa-msg") || "";
    a.href = "https://wa.me/" + numero + (msg ? "?text=" + encodeURIComponent(msg) : "");
    a.addEventListener("click", function () {
      var boton = a.getAttribute("data-wa-from") || "web";
      if (typeof window.fbq === "function") {
        window.fbq("track", "Contact", { content_name: boton });
      }
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture("whatsapp_click", { boton: boton }, { transport: "sendBeacon" });
      }
    });
  });

  // Número visible, con formato argentino (+54 9 351 123-4567).
  var m = numero.match(/^549(\d{3})(\d{3})(\d{4})$/);
  document.querySelectorAll("[data-wa-numero]").forEach(function (el) {
    el.textContent = m ? "+54 9 " + m[1] + " " + m[2] + "-" + m[3] : "+" + numero;
  });

  // Barra fija en el teléfono: aparece cuando el botón del hero sale de pantalla.
  var dock = document.getElementById("dock");
  var heroCta = document.querySelector(".hero .btn-wa");
  var closing = document.querySelector(".closing");
  var demoBrowser = document.querySelector("#demo .browser");
  if ("IntersectionObserver" in window && dock && heroCta) {
    var heroVisible = true, closingVisible = false, demoVisible = false;
    var sync = function () { dock.classList.toggle("is-on", !heroVisible && !closingVisible && !demoVisible); };
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; sync(); }).observe(heroCta);
    new IntersectionObserver(function (e) { closingVisible = e[0].isIntersecting; sync(); }).observe(closing);
    if (demoBrowser) new IntersectionObserver(function (e) { demoVisible = e[0].isIntersecting; sync(); }).observe(demoBrowser);
  }

  // Escena del hero: la charla se reproduce una vez y el turno cae en la agenda.
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var chat = document.getElementById("chat");
  var msgs = Array.prototype.slice.call(chat.querySelectorAll(".msg"));
  var estado = document.getElementById("estado");
  var nuevo = document.getElementById("nuevo");
  var slot = nuevo.querySelector("[data-slot]");
  var lleno = nuevo.querySelector("[data-lleno]");
  var toast = document.getElementById("toast");
  var repetir = document.getElementById("repetir");
  var timers = [];
  var libre = document.createElement("span");
  libre.textContent = english ? "Available" : "Libre";

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function setSlot(ocupado) {
    nuevo.classList.toggle("is-free", !ocupado);
    nuevo.classList.toggle("is-new", ocupado);
    slot.replaceChildren(ocupado ? lleno : libre);
  }
  function play() {
    timers.forEach(clearTimeout); timers = [];
    repetir.hidden = true;
    msgs.forEach(function (el) { el.hidden = true; el.classList.remove("is-entering"); });
    setSlot(false);
    toast.classList.add("is-hidden");
    var t = 500;
    msgs.forEach(function (el) {
      var bot = el.getAttribute("data-t") === "bot";
      if (bot) {
        later(function () { estado.textContent = english ? "typing…" : "escribiendo…"; estado.classList.add("is-typing"); }, t);
        t += 1300;
      } else {
        t += 900;
      }
      later(function () {
        el.hidden = false; el.classList.add("is-entering");
        estado.textContent = english ? "online" : "en línea"; estado.classList.remove("is-typing");
        if (el.hasAttribute("data-final")) {
          later(function () {
            setSlot(true); nuevo.classList.remove("flash"); void nuevo.offsetWidth; nuevo.classList.add("flash");
            toast.classList.remove("is-hidden");
          }, 450);
          later(function () { repetir.hidden = false; }, 1400);
        }
      }, t);
      t += 250;
    });
  }
  repetir.addEventListener("click", play);

  if (!reduce && "IntersectionObserver" in window) {
    var started = false;
    new IntersectionObserver(function (e, obs) {
      if (e[0].isIntersecting && !started) { started = true; obs.disconnect(); play(); }
    }, { threshold: 0.35 }).observe(document.getElementById("escena"));
  }
})();
