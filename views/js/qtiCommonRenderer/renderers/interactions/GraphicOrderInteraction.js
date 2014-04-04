/**
 * @author Bertrand Chevrier <bertrand@taotesting.com>
 */
define([
    'jquery',
    'lodash',
    'i18n',
    'raphael',
    'scale.raphael',
    'tpl!taoQtiItem/qtiCommonRenderer/tpl/interactions/graphicOrderInteraction',
    'taoQtiItem/qtiCommonRenderer/helpers/Graphic',
    'taoQtiItem/qtiCommonRenderer/helpers/PciResponse',
    'taoQtiItem/qtiCommonRenderer/helpers/Helper'
], function($, _, __, raphael, scaleRaphael, tpl, graphic,  pciResponse, Helper){


    /**
     * Init rendering, called after template injected into the DOM
     * All options are listed in the QTI v2.1 information model:
     * http://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html#element10321
     * 
     * @param {object} interaction
     */
    var render = function render(interaction){
        var $container = Helper.getContainer(interaction);
        var $orderList = $('ul', $container);
        var background = interaction.object.attributes;
        var bgImage;

        //TODO change image path
        if(raphael.type === 'SVG'){
            interaction.paper = scaleRaphael('graphic-paper-' + interaction.serial, background.width, background.height);
            bgImage = interaction.paper.image("/taoQtiItem/test/samples/test_base_www/" + background.data, 0, 0, background.width, background.height);
       
            //scale on creation
            resizePaper();
            
            //execute the resize every 100ms when resizing
            $(window).resize(_.throttle(resizePaper, 100));
        } else {

            //for VML rendering, we do not scale...
            interaction.paper = raphael('graphic-paper-' + interaction.serial, background.width, background.height);
            bgImage = interaction.paper.image("/taoQtiItem/test/samples/test_base_www/" + background.data, 0, 0, background.width, background.height);
            $orderList.width( (background.width - 22) + 'px');
        }
        bgImage.id = 'bg-image-' + interaction.serial;

        //create the list of number to order
        _renderOrderList(interaction, $orderList);

        //call render choice for each interaction's choices
        _.forEach(interaction.getChoices(), _.partial(_renderChoice, interaction, $orderList));

        //set up the constraints instructions
        _setInstructions(interaction);

        /**
         * scale the raphael paper
         * @private
         */
        function resizePaper(){
            var containerWidth = $container.width();
            var bgWidth = background.width;

            interaction.paper.changeSize(containerWidth, background.height, false, false);
            
            $orderList.width( ((containerWidth < bgWidth ?  containerWidth : bgWidth) - 22) + 'px');
        }
    };

    /**
     * Render a choice inside the paper. 
     * Please note that the choice renderer isn't implemented separately because it relies on the Raphael paper instead of the DOM.
     * @private
     * @param {Object} interaction
     * @param {jQueryElement} $orderList - the list than contains the orderers
     * @param {Object} choice - the hotspot choice to add to the interaction
     */
    var _renderChoice  =  function _renderChoice(interaction, $orderList, choice){
        var rElement;
        var shape = choice.attributes.shape;
        var coords = choice.attributes.coords;

        rElement = graphic.createElement(interaction.paper, shape, coords);
        if(rElement){
            rElement.id = choice.serial;
            rElement
                .attr(graphic.states.basic)
                .attr('title', __('Select this area'))
                .hover(
                  function(){
                   graphic.updateElementState(this, 'hover'); 

                }, function(){
                    graphic.updateElementState(this, this.active ? 'active' : 'basic');
                })
                .click(function(){
                    if(this.active){
                        _unselectShape(interaction.paper, this, $orderList);
                    } else {
                        _selectShape(interaction.paper, this, $orderList);
                    }
                    Helper.validateInstructions(interaction, { choice : choice });
                });
        }
    };

    /**
     * Render the list of numbers
     * @private
     * @param {Object} interaction
     * @param {jQueryElement} $orderList - the list than contains the orderers
     */
    var _renderOrderList = function _renderOrderList(interaction, $orderList){
        var $orderers;
        var size = _.size(interaction.getChoices());
        var min = interaction.attr('minChoices');
        var max = interaction.attr('maxChoices');

        //calculate the number of orderer to display
        if(max > 0 && max < size){
            size = max;
        } else if(min > 0 && min < size){
           size = min;
        }

        //add them to the list
        _.times(size, function(index){
            var position = index + 1;
            var $orderer = $('<li class="selectable" data-number="' + position + '">' + position +  '</li>');
            if(index === 0){
                $orderer.addClass('active');
            }
            $orderList.append($orderer);
        });

        //create related svg texts
        _createTexts(interaction.paper, size, $orderList);

        //bind the activation event
        $orderers = $orderList.children('li');
        $orderers.click(function(e){
            e.preventDefault();
            var $orderer = $(this);    
        
            if(!$orderer.hasClass('active') && !$orderer.hasClass('disabled')){
                $orderers.removeClass('active');
                $orderer.addClass('active');
            }
        }); 
    };

    /**
     * Select a shape to position an order
     * @private 
     * @param {Raphael.Paper} paper - the interaction paper
     * @param {Raphael.element} element - the selected shape
     * @param {jQueryElement} $orderList - the list than contains the orderers
     */
    var _selectShape = function _selectShape(paper, element, $orderList){
        
        //lookup for the active number
        var $active = $orderList.find('.active:first');
        if($active.length && $active.data('number') > 0){

            //associate the current number directly to the element
            element.data('number', $active.data('number'));
            element.active  = true;
            _showText(paper, element); 
            graphic.updateElementState(element, 'active');
            
            //update the state of the order list
            $active.toggleClass('active disabled').siblings(':not(.disabled)').first().toggleClass('active');
        }
    };

    /**
     * Unselect a shape to free the position
     * @private 
     * @param {Raphael.Paper} paper - the interaction paper
     * @param {Raphael.element} element - the unselected shape
     * @param {jQueryElement} $orderList - the list than contains the orderers
     */
    var _unselectShape = function _unselectShape(paper, element, $orderList){
        var number = element.data('number');
        
        //update element state
        element.active  = false;
        _hideText(paper, element); 
        element.removeData('number');
        graphic.updateElementState(element, 'basic');
        
        //reset order list state and activate the removed number
        $orderList
            .children().removeClass('active')
            .filter('[data-number='+number+']').removeClass('disabled').addClass('active');
    };

    /**
     * Creates ALL the texts (the numbers to display in the shapes). They are created styled but hidden.
     * 
     * TODO parametrize styles
     *
     * @private 
     * @param {Raphael.Paper} paper - the interaction paper
     * @param {Number} size - the number of numbers to create...
     * @param {jQueryElement} $orderList - the list than contains the orderers
     * @return {Array} the creates text element
     */
    var _createTexts = function _createTexts(paper, size){
        var texts = [];
        _.times(size, function(index){
            var number = index + 1;
            var text = paper.text(0, 0, number);
            text.hide();
            text.id = 'text-' + number;
            text.attr({
                    'fill' : '#ffffff',
                    'stroke': '#000000',
                    'stroke-width' : 0.7,
                    'font-family' : '"Franklin Gothic","Source Sans Pro",sans-serif',
                    'font-weight': 'bold', 
                    'font-size' : 24,
                    'cursor' : 'pointer'
                });

            //clicking the text will has the same effect that clicking the shape: unselect.
            text.click(function(){
                paper.forEach(function(element){
                    if(element.data('number') === number && element.events){  //we just need to retrieve the right element
                        //call the click event 
                        var evt = _.where(element.events, { name : 'click'});
                        if(evt.length && evt[0] && typeof evt[0].f === 'function'){
                            evt[0].f.call(element);
                        }
                    }
                });
            });
            texts.push(text);
        });
        return texts;
    };

    /**
     * Show the text that match the element's number. 
     * We need to display it at the center of the shape.
     * @private 
     * @param {Raphael.Paper} paper - the interaction paper
     * @param {Raphael.Element} element - the element to show the text for
     */
    var _showText =  function _showText(paper, element){
        var bbox = element.getBBox();
        var transf;

        //we retrieve the good text from it's id 
        var text = paper.getById('text-' + element.data('number'));
        if(text){
        
            //move it to the center of the shape (using absolute transform), and than display it
            transf = 'T' + (bbox.x + (bbox.width / 2)) + ',' +
                           (bbox.y + (bbox.height / 2));
            text.transform(transf)
                .show()
                .toFront();
        }
    };

    /**
     * Hide an element text.
     * @private 
     * @param {Raphael.Paper} paper - the interaction paper
     * @param {Raphael.Element} element - the element to hide the text for
     */
    var _hideText =  function _hideText (paper, element){
        var text = paper.getById('text-' + element.data('number'));
        if(text){
            text.hide();
        }
    };
    /** 
     * Set the instructions regarding the constrains, here min and maxChoices.
     * @private
     * @param {Object} interaction
     */
    var _setInstructions = function _setInstructions(interaction){

        var min = interaction.attr('minChoices'),
            max = interaction.attr('maxChoices'),
            msg;

        //if maxChoice = 0, inifinite choice possible
        if(max > 0 && max === min){
            msg = (max <= 1) ? __('You must select exactly %d choice', max) : __('You must select exactly %d choices', max);
            Helper.appendInstruction(interaction, msg, function(data){
                if(_getRawResponse(interaction).length >= max){
                    this.setLevel('success');
                    if(this.checkState('fulfilled')){
                        this.update({
                            level : 'warning',
                            message : __('Maximum choices reached'),
                            timeout : 2000,
                            start : function(){
                                highlightError(data.target);
                            },
                            stop : function(){
                                this.update({level : 'success', message : msg});
                            }
                        });
                    }
                    this.setState('fulfilled');
                } else {
                    this.reset();
                }
            });

         } else if( max > 0 && max > min){
            msg = (max <= 1) ? __('You can select maximum %d choice', max) : __('You can select maximum %d choices', max);
            Helper.appendInstruction(interaction, msg, function(data){
                if(_getRawResponse(interaction).length >= max){
                    this.setLevel('success');
                    this.setMessage(__('Maximum choices reached'));
                    if(this.checkState('fulfilled')){
                        this.update({
                            level : 'warning',
                            timeout : 2000,
                            start : function(){
                                highlightError(data.target);
                            },
                            stop : function(){
                                this.setLevel('info');
                            }
                        });
                    }
                    this.setState('fulfilled');
                } else {
                    this.reset();
                }
            });
        } else if(min > 0){
            msg = (min <= 1) ? __('You must at least %d choice', min) : __('You must select at least %d choices', max);
            Helper.appendInstruction(interaction, msg, function(){
                if(_getRawResponse(interaction).length >= min){
                    this.setLevel('success');
                } else {
                    this.reset();
                }
            });
        }

        function highlightError(target){
            if(target){
                graphic.updateElementState(target, 'error');
                _.delay(function(){
                    graphic.updateElementState(target, 'success');
                }, 600);
           }
        }
    };
   
    /**
     * Get the responses from the interaction
     * @private 
     * @param {Object} interaction
     * @returns {Array} of points
     */
    var _getRawResponse = function _getRawResponse(interaction){
        var response = [];
        _.forEach(interaction.getChoices(), function(choice){
            var elt = interaction.paper.getById(choice.serial);
            if(elt && elt.data('number')){
                response.push({
                    index : elt.data('number'),
                    id : choice.attributes.identifier          
                });
            }
        });
        return _(response).sortBy('index').map('id').value();
    };
 
    /**
     * Set the response to the rendered interaction.
     * 
     * The response format follows the IMS PCI recommendation :
     * http://www.imsglobal.org/assessment/pciv1p0cf/imsPCIv1p0cf.html#_Toc353965343  
     * 
     * Available base types are defined in the QTI v2.1 information model:
     * http://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html#element10321
     * 
     * Special value: the empty object value {} resets the interaction responses
     * 
     * @param {object} interaction
     * @param {object} response
     */
    var setResponse = function(interaction, response){
        var responseValues;
        var $container = Helper.getContainer(interaction);
        var $orderList = $('ul', $container);
        if(response && interaction.paper){

            try {
                //try to unserualize tthe pci response
                responseValues = pciResponse.unserialize(response, interaction);
            } catch(e){}
            
            if(_.isArray(responseValues)){
                _.forEach(responseValues, function(responseValue, index){
                    var element;
                    var number = index + 1;

                    //get the choice that match the response
                    var choice = _(interaction.getChoices()).where({'attributes' : { 'identifier' : responseValue}}).first();
                    if(choice){
                       element = interaction.paper.getById(choice.serial);
                       if(element){    
                            //activate the orderer to be consistant
                            $orderList.children('[data-number='+number+']').addClass('active');
    
                            //select the related shape
                            _selectShape(interaction.paper, element, $orderList);
                       }
                    }
                });
            }
        }
    };

    /**
     * Reset the current responses of the rendered interaction.
     * 
     * The response format follows the IMS PCI recommendation :
     * http://www.imsglobal.org/assessment/pciv1p0cf/imsPCIv1p0cf.html#_Toc353965343  
     * 
     * Available base types are defined in the QTI v2.1 information model:
     * http://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html#element10321
     * 
     * Special value: the empty object value {} resets the interaction responses
     * 
     * @param {object} interaction
     * @param {object} response
     */
    var resetResponse = function resetResponse(interaction){
        var $container = Helper.getContainer(interaction);
        var $orderList = $('ul', $container);
        
        _.forEach(interaction.getChoices(), function(choice){
            var element = interaction.paper.getById(choice.serial);
            if(element){
                _unselectShape(interaction.paper, element, $orderList);
            }
        });

        $orderList.children('li').removeClass('active disabled').first().addClass('active');        
    };


    /**
     i* Return the response of the rendered interaction
     * 
     * The response format follows the IMS PCI recommendation :
     * http://www.imsglobal.org/assessment/pciv1p0cf/imsPCIv1p0cf.html#_Toc353965343  
     * 
     * Available base types are defined in the QTI v2.1 information model:
     * http://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html#element10321
     * 
     * @param {object} interaction
     * @returns {object}
     */
    var getResponse = function(interaction){
        return  pciResponse.serialize(_getRawResponse(interaction), interaction);
    };

    /**
     * Expose the common renderer for the interaction
     * @exports qtiCommonRenderer/renderers/interactions/SelectPointInteraction
     */
    return {
        qtiClass : 'graphicOrderInteraction',
        template : tpl,
        render : render,
        getContainer : Helper.getContainer,
        setResponse : setResponse,
        getResponse : getResponse,
        resetResponse : resetResponse
    };
});
