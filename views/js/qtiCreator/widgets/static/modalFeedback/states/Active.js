define(['taoQtiItem/qtiCreator/widgets/states/factory', 'taoQtiItem/qtiCreator/widgets/states/Active', 'ui/modal'], function(stateFactory, Active){

    var StaticStateActive = stateFactory.create(Active, function(){
        
        var _widget = this.widget,
            $container = this.widget.$container;
        
        $container.modal({startClosed:true});
        $container.modal('open');
        $container.on('closed.modal', function(){
            _widget.changeState('sleep');
        });
        
    },function(){
        
        var $container = this.widget.$container;
        
        $container.off('opened.modal');
        $container.modal('close');
        
    });

    return StaticStateActive;
});