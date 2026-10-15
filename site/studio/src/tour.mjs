// The tour never changes a profile. Progress comes from the same application
// state and recognition callbacks as ordinary authoring.
export class SpotlightTour {
    constructor(step, exit, text) {
        this.step=step;this.exit=exit;this.text=text;this.blocked=[];
        this.hole=document.createElement("div");this.hole.className="tour-hole";this.hole.hidden=true;
        this.card=document.createElement("aside");this.card.id="pipeline-guide";this.card.className="tour-card";this.card.hidden=true;
        this.card.innerHTML='<strong>HI</strong><p id="guide-instruction" role="status"></p><button type="button" id="leave-guide" class="text-button"></button>';
        this.card.querySelector("button").onclick=()=>{exit();this.update();};
        document.body.append(this.hole,this.card);
        this.schedule=()=>{if(this.queued)return;this.queued=true;queueMicrotask(()=>{this.queued=false;this.update();});};
        for(const event of ["click","input","change","keyboard-editor-change","close"])document.addEventListener(event,this.schedule,true);
        window.addEventListener("resize",()=>this.position());window.addEventListener("scroll",()=>this.position(),true);
        this.resize=new ResizeObserver(()=>this.position());
        for(const event of ["click","pointerdown","keydown","focusin"])document.addEventListener(event,e=>{
            if(this.current&&event==="keydown"&&e.key==="Escape"){exit();this.update();return;}
            if(!this.current||this.allowed.some(node=>node.contains(e.target)))return;
            e.preventDefault();e.stopImmediatePropagation();
            if(event==="focusin")this.card.querySelector("button").focus({preventScroll:true});
        },true);
    }
    restore(){for(const node of this.blocked)node.inert=false;this.blocked=[];document.querySelectorAll(".tour-target").forEach(node=>node.classList.remove("tour-target"));}
    update(){
        this.restore();this.current=this.step();
        this.card.hidden=this.hole.hidden=!this.current;
        this.resize.disconnect();
        if(!this.current){delete document.body.dataset.tourStep;this.previous=null;this.target=null;this.allowed=[];return;}
        const {id,target,message,extra=""}=this.current;
        document.body.dataset.tourStep=id;
        const host=document.querySelector("dialog[open]")??document.body;
        if(this.card.parentNode!==host)host.append(this.hole,this.card);
        this.target=document.querySelector(target);if(!this.target)return;
        this.allowed=[this.target,this.card,...document.querySelectorAll(extra||".tour-never")];
        // Inert whole sibling branches, rather than disabling controls and losing
        // their existing enabled/disabled state. Native dialog focus still works.
        const visit=node=>{for(const child of node.children){if([this.hole,...this.allowed].some(item=>item===child))continue;if(this.allowed.some(item=>child.contains(item)))visit(child);else if(!child.inert){child.inert=true;this.blocked.push(child);}}};
        visit(document.body);
        this.target.classList.add("tour-target");
        this.card.querySelector("p").textContent=message;
        this.card.querySelector("button").textContent=this.text("leaveGuide");
        if(this.previous!==id){this.target.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});this.previous=id;}
        this.resize.observe(this.target);this.position();
    }
    position(){
        if(!this.current||!this.target)return;
        const rect=this.target.getBoundingClientRect();
        Object.assign(this.hole.style,{left:`${rect.left-4}px`,top:`${rect.top-4}px`,width:`${rect.width+8}px`,height:`${rect.height+8}px`});
        const width=Math.min(320,innerWidth-24);this.card.style.width=`${width}px`;
        const h=this.card.offsetHeight;
        const top=rect.bottom+14+h<innerHeight?rect.bottom+14:rect.top-h-14>8?rect.top-h-14:Math.max(8,innerHeight-h-12);
        Object.assign(this.card.style,{left:`${Math.max(12,Math.min(innerWidth-width-12,rect.left))}px`,top:`${top}px`});
    }
}
