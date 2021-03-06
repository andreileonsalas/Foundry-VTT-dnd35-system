import { AbilityUseDialog } from "../apps/ability-use-dialog.js";
import { Selector } from "../apps/selector.js"

/**
 * Override and extend the core ItemSheet implementation to handle D&D3.5e specific item types
 * @type {ItemSheet}
 */
export class ItemSheet35e extends ItemSheet {


	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 560,
      height: 420,
      classes: ["dnd35e", "sheet", "item"],
      resizable: false,
      scrollY: [".tab.details", ".tab.spellbook"],
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}]
    });
  }

  /* -------------------------------------------- */

  /**
   * Return a dynamic reference to the HTML template path used to render this Item Sheet
   * @return {string}
   */
  get template() {
    const path = "systems/dnd35e/templates/items";
    console.log(`${path}/${this.item.data.type}/${this.item.data.type}-sheet.html`);
    return `${path}/${this.item.data.type}/${this.item.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data
   * Start with the base item data and extending with additional properties for rendering.
   */
  getData() {
    const data = super.getData();
    data.labels = this.item.labels;
    
    // Include CONFIG values
    data.config = CONFIG.DND35E;

    // Item Type, Status, and Details
    data.itemType = data.item.type.titleCase();
    data.itemStatus = this._getItemStatus(data.item);
    data.itemProperties = this._getItemProperties(data.item);
    data.isPhysical = data.item.data.hasOwnProperty("quantity");
    data.isSpellcaster = this.item.isSpellcaster;



    // Action Details
    data.hasAttackRoll = this.item.hasAttack;
    data.isHealing = data.item.data.actionType === "heal";
    data.isFlatDC = getProperty(data.item.data, "save.scaling") === "flat";
    data.hasCustomRange = this.hasCustomRange;
    data.hasGridView = this.hasGridView;
    data.hasListView = this.hasListView;
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
   * @return {string}
   * @private
   */
  _getItemStatus(item) {
    if ( ["weapon", "equipment"].includes(item.type) ) return item.data.equipped ? "Equipped" : "Unequipped";
  }

  /* -------------------------------------------- */

  /**
   * Get the Array of item properties which are used in the small sidebar of the description tab
   * @return {Array}
   * @private
   */
  _getItemProperties(item) {
    const props = [];
    const labels = this.item.labels;

    if ( item.type === "weapon" ) {
      props.push(...Object.entries(item.data.properties)
        .filter(e => e[1] === true)
        .map(e => CONFIG.DND35E.weaponProperties[e[0]]));
    }

    else if ( item.type === "spell" ) {
      props.push(
        labels.components,
        labels.materials
      )
    }

    else if ( item.type === "equipment" ) {
      props.push(CONFIG.DND35E.equipmentTypes[item.data.armor.type]);
      props.push(labels.armor);
    }

    // Action type
    if ( item.data.actionType ) {
      props.push(CONFIG.DND35E.itemActionTypes[item.data.actionType]);
    }

    // Action usage
    if ( (item.type !== "weapon") && item.data.activation && !isObjectEmpty(item.data.activation) ) {
      props.push(
        labels.activation,
        labels.range,
        labels.target,
        labels.duration
      )
    }
    return props.filter(p => !!p);
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(position={}) {
    position.height = this._tabs[0].active === "details" ? "auto" : this.options.height;
    return super.setPosition(position);
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
	/* -------------------------------------------- */

  /**
   * Extend the parent class _updateObject method to ensure that damage ends up in an Array
   * @private
   */
  _updateObject(event, formData) {

    // Handle Damage Array
    let damage = Object.entries(formData).filter(e => e[0].startsWith("data.damage.parts"));
    formData["data.damage.parts"] = damage.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(3);
      if ( !arr[i] ) arr[i] = [];
      arr[i][j] = entry[1];
      return arr;
    }, []);

    // Update the Item
    super._updateObject(event, formData);
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for interactive item sheet events
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));
    // Adds the dialog box to add new item
    html.find(".add-item").on("click",event=>{this._addItemFromList(event);});
    // View items in backpack
    html.find(".view-item").on("click", event=>{this._viewItem(event);})
    // Adds the option to drag n drop to icongrid list
    html.find(".dnd-area").on("drop", this._onDrop.bind(this));
  }

  /* -------------------------------------------- */

  get hasCustomRange() {
    const data = super.getData();
    // Checks whether item can have the custom range property
    if (data.type !== "spell"){
      return false;

    }
    else{
      return !!(data.item.data.range.type === "custom");
    };
  };

  get hasListView() {
    const data = super.getData();
    if (typeof data.item.data.content === "undefined"){
      return false;

    }
    else{
      return !!(data.item.data.content.view === "list");
    };
  };
  get hasGridView() {
    const data = super.getData();
    if (typeof data.item.data.content === "undefined"){
      return false;

    }
    else{
      return !!(data.item.data.content.view === "icongrid");
    };
  };

  /**
   * Add or remove a damage part from the damage formula
   * @param {Event} event     The original click event
   * @return {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new damage component
    if ( a.classList.contains("add-damage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const damage = this.item.data.data.damage;
      return this.item.update({"data.extradamage.parts": damage.parts.concat([["", ""]])});
    }

    // Remove a damage component
    if ( a.classList.contains("delete-damage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".damage-part");
      const damage = duplicate(this.item.data.data.extraDamage);
      damage.parts.splice(Number(li.dataset.damagePart), 1);
      return this.item.update({"data.extraDamage.parts": damage.parts});
    }
  }; 

  async _addItemFromList(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const type = this.item.type;
    let choices;
    let attribute;
    if (type === "class"){
      attribute = `data.spellcasting.${a.dataset.spelllevel}`;
      const spells = game.data.items.filter(item => item.type === "spell");
      choices = Object.fromEntries(spells.map(x => [x._id, x]));

    }
    else if (type === "backpack"){
      attribute = "data.content.elements";
      const items = game.data.items.filter(item => item.type === ("consumable" || "loot"));
      choices = Object.fromEntries(items.map(x => [x._id, x]));
    };
    const options = {
      "name": attribute,
      "title": "Spells/Items Selector",
      "choices": choices
    }
    new Selector(this.item, options).render(true);

  }

  async _viewItem(event) {
    event.preventDefault();
    //Get clicked item
    const itemID = event.currentTarget.dataset["itemId"];
    const item = game.items.get(itemID);
    return item.sheet.render(true);
  }

  async _onDrop(event) {
    event.preventDefault();
    let a = this.item;
    // Get dropped data
    const item = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
    console.log("this gets executed");
    console.log(a);
    if (a.type === "backpack") {
      a.addItemToBackpack(item);
    };
    this.render();
    return;
  };
}
