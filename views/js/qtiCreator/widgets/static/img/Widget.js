define([
    'taoQtiItem/qtiCreator/widgets/static/Widget',
    'taoQtiItem/qtiCreator/widgets/static/img/states/states',
    'taoQtiItem/qtiCreator/widgets/static/helpers/widget',
    'tpl!taoQtiItem/qtiCreator/tpl/toolbars/media'
], function(Widget, states, helper, toolbarTpl) {

    var ImgWidget = Widget.clone();

    ImgWidget.initCreator = function() {

        Widget.initCreator.call(this);

        this.registerStates(states);
    };
    
    ImgWidget.buildContainer = function(){
        
        helper.buildInlineContainer(this);
        
        return this;
    };
    
    ImgWidget.createToolbar = function() {
        
         helper.createToolbar(this, toolbarTpl);

        return this;
    };

    return ImgWidget;
});