// No page-to-extension message bridge. Only the extension can issue commands.
if(!globalThis.__migController){
    globalThis.__migController=true;
    const api=globalThis.browser??chrome;
    const editable=element=>!!element?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
    function presentation(){
        if(document.visibilityState!=="visible")return false;
        const visible=selector=>Array.from(document.querySelectorAll(selector)).some(element=>element.getClientRects().length&&getComputedStyle(element).visibility!=="hidden");
        const url=new URL(location.href),host=url.hostname;
        if(host==="docs.google.com")return /\/presentation\/.*\/(present|preview)(\/|$)/.test(url.pathname)||!!document.fullscreenElement;
        if(host==="gamma.app"||host.endsWith(".gamma.app"))return url.searchParams.get("mode")==="present"||!!document.fullscreenElement||visible('[data-testid="presentation-view"],[data-present-mode="true"]');
        if(host==="canva.com"||host.endsWith(".canva.com"))return !!document.fullscreenElement||visible('[data-testid="presentation-view"],[role="application"][aria-label*="Presentation"]');
        return !!document.fullscreenElement||/slideshow|reading\.aspx/i.test(url.pathname)||visible('#SlideShowContent,[data-testid="slideshow-player"]');
    }
    function observe(){api.runtime.sendMessage({type:"presence",presenting:presentation(),focused:document.hasFocus()&&document.activeElement?.tagName!=="IFRAME"}).catch(()=>{});}
    function emit(commands){
        if(!Array.isArray(commands)||commands.length>16||editable(document.activeElement)||document.visibilityState!=="visible")return {ok:false,reason:"Presentation hidden or text field focused"};
        for(const keys of commands){
            if(!Array.isArray(keys)||keys.length<1||keys.length>3||keys.some(value=>!Number.isInteger(value)))return {ok:false};
            const values=keys.filter(value=>value!==16&&value!==17);
            if(values.length!==1)return {ok:false};
            const value=values[0],ctrlKey=keys.includes(17),shiftKey=keys.includes(16);
            const names={8:"Backspace",9:"Tab",13:"Enter",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete"};
            const key=names[value]??((value>=48&&value<=57||value>=65&&value<=90)?String.fromCharCode(value):null);
            if(!key||ctrlKey&&(![65,67,86,88,89,90].includes(value)||shiftKey))return {ok:false};
            const target=document.activeElement&&document.activeElement!==document.documentElement?document.activeElement:document.body;
            const init={key:key.length===1&&!shiftKey?key.toLowerCase():key,code:value>=65&&value<=90?`Key${String.fromCharCode(value)}`:value>=48&&value<=57?`Digit${key}`:key===" "?"Space":key,
                keyCode:value,which:value,ctrlKey,shiftKey,altKey:false,metaKey:false,bubbles:true,cancelable:true,composed:true};
            target.dispatchEvent(new KeyboardEvent("keydown",init));target.dispatchEvent(new KeyboardEvent("keyup",init));
        }
        return {ok:true};
    }
    api.runtime.onMessage.addListener((message,sender,respond)=>{
        if(sender.id!==api.runtime.id)return;
        if(message.type==="observe"){observe();respond({ok:true});}
        if(message.type==="keys")respond(emit(message.commands));
    });
    addEventListener("focus",observe);addEventListener("fullscreenchange",observe);addEventListener("popstate",observe);addEventListener("hashchange",observe);addEventListener("pagehide",()=>api.runtime.sendMessage({type:"presence",presenting:false}).catch(()=>{}));
    setInterval(observe,1000);observe();
}
