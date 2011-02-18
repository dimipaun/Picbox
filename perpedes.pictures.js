( function($) {
    var viewerId = __viewerId;
    var max_pic_load_retries = 2;
    var empty_query = $('#abc');
    var in_page = false;
    var body_sel;
    var cur_request_id = 1;
    var loading_in_progress = false;
    var search_result = null;
    var search_page_start = 0;
    var search_page_size = 0;
    var search_showing = false;
    var search_displayed = true;
    var cur_pic = {};
    var cur_index = -1;
    var cur_index_invalid = false;
    var pref_size = 'h';
    var hide_tags = false;
    var hide_tools = false;
    var showall_populated = false;
    var showall_shown = false;
    var showall_size = 's';
    var extras_hidden = false;
    var auto_fill_tid = null;
    var cmnts_hide = false;
    var cmnts_shown = false;
    var cmnts_need_adjust = false;
    var cmnts_dangling = {};
    var hilited_tag_id = null;
    var playing = false;
    var playTid = null;
    var play_speed = 3000;
    var info_shown = false;
    var google_map_init = false;
    var google_map = null;
    var google_map_width = 0;
    var google_map_shows = false;
    var google_map_zoom_mapped = 16;
    var google_map_zoom_unmapped = 2;
    var google_map_zoom = 0;
    var picture_hilite = null;
    var picture_marker = null;
    var drop_marker = null;
    var mapping_picture = false;
    var video_playing = false;
    
    var INACTIVITY_TIMEOUT = 3000;
    var lastActivityTS = 0;
    var inactivityTid = null;
    var onPrevNext = false;
    var hoveredElement = empty_query;

    var month_names = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
    var showall_info = {i: {cls: 'zb-sall-small', l: 75}, s: {cls: 'zb-sall-medium', l:240}, m: {cls: 'zb-sall-large', l: 500}};
    
    var imagesLayout = null;
    var scroll = false;

    $$.pictures.close = function() {
        if (!in_page) unpreparePicbox();        
    }
    
    function getTrip(id, cntx, name) {
        if (cntx != 2) return null;
        if (search_result) {
            var i, t;
            for (i in search_result.trips) {
                t = search_result.trips[i];
                if (t.id == id) return t;
            }
        } 
        return {id: id, name: name};
    }
    
    $$.pictures.showPicbox = function(searchCnxt, displaySearch, data, searchResult) {
        // reset the transient values
        in_page = window.__picbox_page || false;
        body_sel = $(in_page ? "body" : "#zb-pd-overlay"); 
        cur_request_id = 1;
        loading_in_progress = false;
        cur_index = -1;
        cur_index_invalid = false;
        hide_tags = false;
        hide_tools = false;
        search_result = null;
        search_page_start = 0;
        search_page_size = 0;
        search_showing = false;
        search_displayed = displaySearch;
        showall_populated = false;
        showall_shown = false;
        extras_hidden = false;
        auto_fill_tid = null;
        cmnts_hide = false;
        cmnts_shown = false;
        cmnts_need_adjust = false;
        hilited_tag_id = null;
        playing = false;
        playTid = null;
        onPrevNext = false;
        hoveredElement = empty_query;
        info_shown = false
        google_map_init = false;
        google_map_shows = false;
        google_map = null;
        picture_hilite = null;
        mapping_picture = false;
        
        // for whatever reason IE seems to want this here...
        cur_pic = data.details || {};
        if (!cur_pic.cmnts) cur_pic.cmnts = [];
        
        $(document).keydown(navigationKeyHandler);
        $(window).resize(onResize);
        
        window.__picbox = true;
        $.zipBox.remove();
        
        cur_pic.title = cur_pic.title || (searchCnxt ? "<span><em>Loading photos ...</em></span>" : ""); 

        preparePicbox();
        
        function onShow() {
            populatePicbox(data.details,  {onshow: true});
            ready();
            activityHandler();
        }

        // pre-load the images needed to render the UI
        var imgPreloader = new Image();
        imgPreloader.src = $$.rsrc("../images/picbox-icons-v16.png");
        
        // first handle Show One
        if (data && data.details) {
            var imgPreloader = new Image();
            imgPreloader.onload = onShow;
            imgPreloader.onerror = onShow;
            imgPreloader.src = data.details.imageSrc;
            // mark the spot for the picture to come
            $("#zb-pd-picture").append("<div id='zb-pd-img'></div>");
        } else if (data.msg || !searchCnxt) {
            insertHtml(data.msg || (viewerId ? "The photo or video is not available" : "Login to see photos and videos"));
            ready();
        }
                
        if (searchCnxt) {
            setTimeout( function() {
                if (searchResult) {
                    handleSearchData(searchResult, {
                        searchContext : searchCnxt,
                        forceTitle: true
                    }, function() {
                        ready();
                    });
                } else {
                    pictureSearch({
                        searchContext : searchCnxt,
                        forceTitle: true
                    });
                }
            }, 10);
        }
    }
    
    function preparePicbox() {
        if ($('#zb-pd-body').length) return false; 

        console.time("prep");

        var base = "<div id='zb-pd-body'><div id='zb-pd-map-canvas'></div><div id='zb-pd-page'><div id='zb-pd-hdr' class='shade40'></div><div id='zb-pd-cmnts-notify' class='picbox-icons'></div><div id='zb-pd-main-box'><div id='zb-pd-picture'><div id='zb-pd-tags'></div></div></div><div id='zb-pd-caption' class='fontsize3 shade30'></div></div></div>";
        body_sel.append(base);
        var page = $('#zb-pd-page'); 
        page.mousemove(function(e) {
            var t = $(e.target);
            hoveredElement = t;

            onPrevNext = t.is('#zb-pd-prev') || t.is('#zb-pd-next');
            if (!onPrevNext) activityHandler(e);             
        }).resize(onResize);
        
        $('#zb-pd-tags').click(function(e) {
            var t = $(e.target);
            
            var tagId = t.parents('.zb-pd-tag-lbl:first').getOid(), picId = cur_pic.pictureId;
            if (t.is('.zb-pd-tag-txt') || t.is('.user-link')) {
                return true;
            } else if (t.is('.zp-pd-tag-search')) {
                searchByTag(tagId);
                return false;
            } else if (t.is('.zp-pd-tag-edit')) {
                enterTaggingMode(e, tagId);
                return false;
            } else if (t.is('.zp-pd-tag-rm')) {
                if (confirm("Do you want to delete this tag?")) {
                    $.getJSON("DeletePictureTag.do", {
                        tagId: tagId
                    }, function(data) {
                        removeTag(tagId);
                        $(document).trigger( {
                            type : "pic-tag.zip",
                            picId : picId
                        });
                    });
                }
                return false;
            }            
        }).mousemove(function(e) {
            var t = $(e.target), oldId = hilited_tag_id, newId;
        
            if (!t.is('#zb-pd-tags')) {
                var tagId = t.closest('.zb-pd-tag-lbl').getOid();
                if (tagId) {
                    if  (hilited_tag_id == tagId) {
                            oldId = null; // no need to unhilite now 
                        } else {
                             hiliteTag(newId = tagId, true);
                        }
                }
            }
            if (oldId) {
                hiliteTag(oldId, false);
                hilited_tag_id = null;
            }
            if (newId) hilited_tag_id = newId;
        });

        var headerHtml = ""
            + "<div id='zb-pd-menu-my-box'></div>"
            + "<div class='hdr-nav-left' style='margin: 0;'>"
            + "<ul>"
            + "<li id='zb-pd-title'></li>"
            + "</ul>"
            + "<ul id='zb-pd-hdr-trip-mix'"
            + "<li><div style='padding: 6px 0 0; float: left;'><span class='text'>from</span><a id='zb-pd-menu-cover2' class='menu-link' href='#' title='Trip cover'><b></b></a></div></li>"
            + "<li><a id='zb-pd-more' class='menu-item' href='#fetch-photos' title='Get all photos from this trip'>Open all trip photos</a></li>"
            + "</ul>"
            + "<ul id='zb-pd-hdr-trip-one'>"
            + "<li><a id='zb-pd-menu-itinerary' class='menu-item' href='#' title='Itinerary'><b>Itinerary</b></a></li>"
            + "<li><a id='zb-pd-menu-pictures' class='menu-item' href='#' title='Pictures'><b>Pictures</b></a></li>"            
            + "<li><a id='zb-pd-menu-journal' class='menu-item' href='#' title='Triplog'><b>Triplog</b><span></span></a></li>"
            + "</ul>"
            + "<ul class='hdr-tools' style='float: left;'>"
            + "<li>"
            + "<a id='zb-pd-menu-share-photo' class='menu-item' href='#'><span class='hdr-tool-icon hdr-share-icon header-icons'></span> <span>Share&nbsp;photo</span></a>"
            + "<a id='zb-pd-menu-share-slide' class='menu-item' href='#'><span class='hdr-tool-icon hdr-share-icon header-icons'></span> <span>Share&nbsp;slideshow</span></a>"
            + "</li>"
            + "</ul>"
            + "<div>";
        ;
       
        $("#zb-pd-hdr").append(headerHtml).click( function(e) {
            var t = $(e.target).closest('a');
        
            if (t.is("#zb-pd-menu-share-photo")) {
                stopVideo();
                $.zipBox.show("ShareBox.clip", {
                    contextType : cur_pic.contextType,
                    contextId : cur_pic.contextId,
         	    pictureId: cur_pic.pictureId
	        }, { 
	            type: 'popup'
	        });
	        return false;
            }
            if (t.is("#zb-pd-menu-share-slide")) {
                $.zipBox.show("ShareBox.clip", {
                    searchCnxt: search_result.searchCnxt,
                    forceType : -4,
                    count: search_result.count,
                    videoCnt: search_result.videoCnt
                }, { 
                    type: 'popup'
                });
                return false;
            }
            if (t.is("#zb-pd-more")) {
                pictureSearch({
                    searchMsg : "Fetching trip photos/videos ...",
                    noImagesMsg : "No photos or videos found.",
                    noOthersMsg : "No other photos or videos in this trip.", 
                    searchContext: "tripId:" + cur_pic.contextId
                });
                return false;
            }            
            if (t.is("#zb-arrow-back")) {
                closePicbox('close');
            	return false;
            }
        });
        $('#zb-pd-menu-my-box').load("GetMyHeader.clip");
        setSlideshowTitle(cur_pic.title);
        
        var toolbox = $("<div id='zb-pd-btns-box' class='shade30 zb-pd-hide'>"
                + "<a href='#' id='zb-pd-prev' class='zb-pd-btn picbox-icons'></a>"
                + "<a href='#' id='zb-pd-next' class='zb-pd-btn picbox-icons'></a>"
                + "<a href='#' id='zb-pd-play' class='zb-pd-btn picbox-icons' title='Play this slideshow'></a>"
                + "<a href='#' id='zb-pd-pause' class='zb-pd-btn picbox-icons' title='Pause this slideshow' style='display: none'></a>"
                + "<a href='#' id='zb-pd-cmnts' class='zb-pd-btn picbox-icons' title='Show/hide comments'></a>"
                + "<a href='#' id='zb-pd-geo' class='zb-pd-btn picbox-icons' title='Show/hide the map'></a>"
                + "<a href='#' id='zb-pd-info' class='zb-pd-btn picbox-icons' title='Show/hide picture information'></a>"
                + "<span id='zb-pd-btns-sep' class='zp-pd-btns-sep zb-pd-btn'></span>"
                + "<a href='#' id='zb-pd-rotate-left' class='zb-pd-btn picbox-icons' title='Rotate picture left'></a>"
                + "<a href='#' id='zb-pd-rotate-right' class='zb-pd-btn picbox-icons' style='margin-left: 1px;' title='Rotate picture right'></a>"
                + "<a href='#' id='zb-pd-trash' class='zb-pd-btn picbox-icons' title='Delete this picture'></a>"
                + "<span id='zb-pd-cnt' class='zb-pd-btn fontsize0'></span>"
                + "</div>");

        if ($.browser.msie6) toolbox.removeClass('shade30');
        
        toolbox.click( function(e) {
            var t = $(e.target);

            function rotate(turns) {
                thinking();
                stopVideo();
                $.ajax( {
                    type : "POST",
                    url : 'RotatePicture.do',
                    data : {
                        pictureId : cur_pic.pictureId,
                        rightTurns : turns
                    },
                    success : function(pic) {
                	if (pic.id && pic.secret) {
                    	    // touch up the cached data to refresh it with the new secret
                            var replRE = new RegExp("(/" + pic.id + "-[0-9a-f]*)"), replPart = "/" + pic.id + "-" + pic.secret;
                            $('#zb-pd-srch-' + pic.id + '>img, #zb-pd-sall-' + pic.id + '>img').each(function() {
                                $(this).attr('src', $(this).attr('src').replace(replRE, replPart));                            
                            });                        
                            var p = picInfo(getPictureIndex(pic.id));
                            if (p) {
                                p.meta.secret = pic.secret;
                                p.w = pic.w;
                                p.h = pic.h;
                                p.url = p.url.replace(replRE, replPart);
                                invalidateShowallIcon(p);
                            }
                            loadPicture();
                            $(document).trigger( {
                                type : "pic-rotate.zip",
                                picId : pic.id
                            });
                	}
                        ready();
                    },
                    error : function() {
                        ready();
                    },
                    dataType : "json"
                });
            }
            t.blur();
            
            if (t.is("#zb-pd-prev")) {
                showPrev();
                return false;
            }
            if (t.is("#zb-pd-next")) {
                showNext();
                return false;
            }

            activityHandler(e);            

            if (t.is('#zb-pd-play')) {
                playStart();
                return false;
            }
            
            if (t.is('#zb-pd-pause')) {
                playPause();
                return false;
            }

            if (t.is("#zb-pd-cmnts")) {
                if (cmnts_shown) {
                    hideComments();
                    cmnts_hide = true;
                } else {
                    if (playing) playPause();
                    stopVideo();
                    cmnts_hide = false;
                    showComments();                    
                }
                return false;
            }
            if (t.is("#zb-pd-info")) {
                var i = $('#zb-pd-info-box');
                if (!i.length) {
                    i = prepareInfo();
                    populateInfo(cur_pic);
                }
                i[info_shown ? "fadeOut" : "fadeIn"]('fast');
                info_shown = !info_shown;
                return false;                
            }
            if (t.is("#zb-pd-geo")) {
                showMap(!google_map_shows);
                return false;
            }
            if (t.is("#zb-pd-rotate-left")) {
                rotate(3);
                return false;
            }
            if (t.is("#zb-pd-rotate-right")) {
                rotate(1);
                return false;
            }
            if (t.is("#zb-pd-trash")) {
                if (confirm("Picture deletion cannot be undone. Proceed?"))
                    deletePicture(cur_pic.pictureId);
                return false;
            }
        });
        
        page.append(toolbox);
        page.append("<div id='zb-pd-play-hint' class='shade-0b-85 fontsize3'></div>");

        $("#zb-pd-picture").click(function(e) {
            var t = $(e.target); 
            if ((t.is('#zb-pd-picture') || t.is('#zb-pd-tags') || t.is('#zb-pd-img')) && 
                (!cur_pic.video && !cur_pic.tagEditing && !isCaptionEdited())) {
                enterTaggingMode(e);
            } else {
                activityHandler(e);
            }
        });

        console.timeEnd("prep");
        
        return true;
    }

    function setSlideshowTitle(t) {
        $("#zb-pd-title").html(t||'').find('a').addClass('menu-link').end().find('span').addClass('text').end().children(':first').filter('span').addClass('text-first');
    }
    
    function unpreparePicbox() {
        // remove outstanding bubbles
        $.zipBox.remove();
        // unprepare things here        
        $("#zb-pd-overlay").remove();
        $("html").css('overflow', '');
        $(window).unbind('resize', onResize);
        $(document).unbind("keydown", navigationKeyHandler);
        if ($.browser.msie6) {
            $("body","html").css({height: "auto", width: "auto"});
        }        
        ready();
    }

    function positionToolbox() {
        var tb = $('#zb-pd-btns-box');
        
        if (tb.is('.zb-pd-btns-simple')) return;
        var w = tb.width() + 17, pw = page_width(), l = Math.max(0, (pw - w) / 2);
        tb.add('#zb-pd-caption').css('left', l);
    }

    function showPrevNext() {
        var cnt = total_cnt();
        $("#zb-pd-prev, #zb-pd-next").showhide(cnt > 1);
        $('#zb-pd-play').showhide(cnt > 1 && !playing);
        $("#zb-pd-pause").showhide(cnt > 1 && playing);;
        $('#zb-pd-cnt').text( (cur_index >= 0 ? ((cur_index + 1) + " / ") : "") + cnt).showhide(
                cnt > 1 && cur_index >= 0 && cur_index < cnt);
        positionToolbox();
    }

    function prepareCmnts() {
        if ($('#zb-pd-cmnts-box').length) return;

        var html = "<div id='zb-pd-cmnts-box' class='shade-0b-85'>"
                 + "<a href='#' id='zb-pd-cmnts-hide' class='fontsize0'>hide comments &raquo;</a>"
                 + "<div id='zb-pd-cmnts-body'><div id='zb-pd-cmnts-pane'><div><div id='zb-pd-cmnts-holder'></div></div></div></div>"
                 + "<div id='zb-pd-cmts-footer'>"
                 + "<div id='zb-pd-cmnt-add-area' style='display: none'><div id='zb-pd-cmnt-add-box'><p>Add a comment:</p><div id='zp-pd-new-cmnt' class='shade-comment'><textarea id='zb-pd-cmnt-textarea'></textarea></div>"
                 + "<div id='zb-pd-cmnt-legend' class='legend' style='display: none'><a id='zb-pd-cmnt-post' class='btn post' href='#' title='Send this comment'>Send</a>"
                 + "<span class='accel-hint'>or press Ctrl-Enter to send</span></div></div>"
                 + "<div id='zb-pd-cmnt-add-nologin' style='display: none; margin: 0 0 20px 2px;'><a href='#signin' onclick='return $$.site.login(this);' id='zb-pd-cmnt-login'>Login to comment on this picture.</a></div>"
                 + "</div><div class='float-flush' ></div></div></div>";
        $("#zb-pd-page").append(html);

        var legend = $('#zb-pd-cmnt-legend');
        $('#zb-pd-cmnt-textarea').keydown( function(e) {
            e.stopPropagation();
        }).focus(function() {
            legend.fadeIn();
            adjustComments(false, true);
        }).blur(function(e) {
            if (!$.trim($(e.target).val())) {
                legend.fadeOut();
            }
        });
        $('#zb-pd-cmnts-box').click( function(e) {
            var t = $(e.target);
            
            if (t.is('#zb-pd-cmnts-hide')) {
                cmnts_hide = true;
                hideComments();
                return false;
            }
            if (t.is('#zb-pd-cmnt-post')) {
                if (!viewerId) {
                    alert("You need to login to comment on a picture.");
                    return false;
                }
                var ta = $('#zb-pd-cmnt-textarea'), txt = $.trim(ta.val());
                if (!txt) {
                    alert("Cannot send an empty comment");
                } else {
                    thinking();
                    $.ajax( {
                        type : "POST",
                        url : 'AddPictureComment.do',
                        data : {
                            pictureId : cur_pic.pictureId,
                            content : txt
                        },
                        success : function(c) {
                            if (!c || !c.bodyAsHTML)
                                return;
                            ta.val('');
                            delete cmnts_dangling[cur_pic.pictureId];
                            cur_pic.cmnts.push(c);
                            $('#zb-pd-cmnts-help').hide();
                            $('#zb-pd-cmnts-hide').show();
                            $('#zb-pd-cmnts-holder').append(fmtComment(c));
                            adjustComments(true, true);
                            ta.blur();
                            $(document).trigger( {
                                type : "pic-comment.zip",
                                picId : cur_pic.pictureId,
                                commentId : c.id
                            });
                            ready();
                        },
                        error : function() {
                            ready();
                        },
                        dataType : "json"
                    });
                }
                return false;
            }
            if (t.is('#zb-pd-cmnt-login')) {
                doLogin();
                return false;
            }
            if (t.is('#zb-pd-cmnt-trash')) {
                if (!confirm("Comment deletion cannot be undone. Proceed?"))
                    return false;
                var p = t.parents('.zb-cmnt-box'), m = p.metadata();
                $.ajax( {
                    type : "POST",
                    url : 'RemovePictureComment.do',
                    data : {
                        commentId : m.id
                    },
                    success : function() {
                        p.fadeOut(function() {
                            p.remove();
                            if (!cur_pic.cmnts.length) {
                                $('#zb-pd-cmnts-hide').fadeOut();
                                $('#zb-pd-cmnts-help').fadeIn();
                            }
                        });
                        for (var i = 0; i < cur_pic.cmnts.length; i++) {
                            if (cur_pic.cmnts[i].id == m.id) {
                                cur_pic.cmnts.splice(i, 1);
                                break;
                            }
                        }
                    },
                    error : function() {
                        t.show();
                    },
                    dataType : "json"
                });
                t.hide();
                return false;
            }
        })
        
        $('#zb-pd-cmnt-post').ctrlEnterIn('#zb-pd-cmnt-textarea');
    }

    function fmtComment(c) {
        var isAuthor = viewerId == c.authorId;
        var name = $.abbreviate(c.authorName || '', 15);
        var d = new Date(c.creationTS);
        var ds = month_names[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        var h = d.getHours(), a_p = "am", m = d.getMinutes();
        if (h == 0) {
            h = 12;
        } else if (h > 12) {
            h = h - 12;
            a_p = "pm";
        }
        m = m + "";
        if (m.length == 1) {
            m = "0" + m;
        }
        ds = ds + ', ' + h + ":" + m + a_p;
        var s = "<div class='zb-cmnt-box {id:"
                + c.id
                + "}'><div class='zb-pd-cmnt-hdr'>"
                + "<table cellpadding='0' cellborder='0' width='100%'><tr><td>"
                + (isAuthor ? "you said"
                        : "<a class='user-link' href='Profile.page?userId="
                                + c.authorId + "'>" + name + "</a>")
                + "</td><td align='right'>" + "<span class='when'>" + ds + "</span></td>"
                + (isAuthor || isEditor() ? "<td width='20'><a href='#' id='zb-pd-cmnt-trash' class='picbox-icons'></a></td>" : "")
                + "</tr></table></div>"
                + "<div class='zb-cmnt-body'>" + c.bodyAsHTML + "</div></div>";
        return s;
    }
    function hideComments(speed) {
        $('#zb-pd-cmnts-box')[speed ? 'fadeOut' : 'hide'](speed);
        cmnts_shown = false;
        $("#zb-pd-cmnts").attr("title", "Show comments").onoffClass('zb-pd-notify', cur_pic.cmnts.length > 0);
    }
    function showComments(speed) {
        prepareCmnts();

        $('#zb-pd-cmnt-add-box').showhide(viewerId);
        $('#zb-pd-cmnt-add-nologin').showhide(!viewerId);

        cmnts_shown = true;
        var bh = $('#zb-pd-cmnts-box')[speed ? 'fadeIn' : 'show'](speed).height();
        $('#zb-pd-cmnt-add-area').show();
        var fh = $('#zb-pd-cmts-footer').outerHeight( {
            margin : true
        });
        $('#zb-pd-cmnts-body,#zb-pd-cmnts-pane').height(bh - fh - 20);
        if (cmnts_need_adjust) {
            adjustComments(false, true);
        }
        //$('#zb-pd-cmnt-add-box textarea')[0].focus();
        $("#zb-pd-cmnts").attr("title", "Hide comments").removeClass('zb-pd-notify');
    }
    function notifyComments() {        
        $('#zb-pd-cmnts-notify').showhide(!cmnts_shown && cur_pic.cmnts.length > 0 && !$('#zb-pd-btns-box').visible() && !cur_pic.tagEditing);
    }
    function adjustComments(maintainPos, scrollDown) {
        if (true) {
            var bh = $('#zb-pd-cmnts-box').height();
            var fh = $('#zb-pd-cmts-footer').outerHeight( {
                margin : true
            });
            var h = bh - fh - 20;
            $('#zb-pd-cmnts-body,#zb-pd-cmnts-pane').height(h);
        }
        if (scrollDown) {
            $("#zb-pd-cmnts-pane").scrollTop(9999);
        }
        cmnts_need_adjust = false;
    }
    function populateComments(cmnts) {
        prepareCmnts();

        var i, s;
        s = "<div id='zb-pd-cmnts-help' class='fontsize1'><em>Be the first to comment on this " + (cur_pic.video ? "video" : "photo") + ".</em></div>";
        for (i = 0; i < cmnts.length; i++) {
            s += fmtComment(cmnts[i]);
        }
        $("#zb-pd-cmnts-holder").html(s);
        $('#zb-pd-cmnts-help').showhide(!cmnts.length);
        $('#zb-pd-cmnts-hide').showhide(cmnts.length);
        
        var txt = cmnts_dangling[cur_pic.pictureId];
        $('#zb-pd-cmnt-textarea').val(txt || '');
        $('#zb-pd-cmnt-legend').showhide(txt);
        
        cmnts_need_adjust = true;
    }
    
    function insertHtml(html) {
        var ps = page_size();
        
        $("#zb-pd-img").remove();
        
        $("#zb-pd-picture").append($("<div id='zb-pd-img' class='zb-pd-img-msg'></div>").html(html));
	
        $('#zb-pd-main-box').show();
        
        var bw = Math.min($("#zb-pd-img").width(), parseInt(ps.width * 0.8));
        var bh = $("#zb-pd-img").height();
        $('#zb-pd-main-box').css({
            top : (ps.height - bh) / 2,
            left : (ps.width - bw) / 2,
            width : bw,
            height : bh
        });

        $('#zb-pd-tags').hide().empty();
        $('#zb-pd-btns-box,#zb-pd-caption').hide();
        hide_tools = hide_tags = true;
    }
    
    function insertImage(autoPlay) {
        var iw = cur_pic.imageWidth || 0, ih = cur_pic.imageHeight || 0, ps = page_size();

        var bw = iw, bh = ih;
        var f = Math.min(ps.width / iw, ps.height / ih);
        if (f < 1.0) {
            bw = Math.round(f*iw);
            bh = Math.round(f*ih);
        }
        
        $("#zb-pd-img").remove();
        $('#zb-pd-main-box').css({
            left : (ps.width - bw) / 2,
            top : (ps.height - bh) / 2,
            width : bw,
            height : bh,
            display : 'block'
        });

        video_playing = false;
        if (cur_pic.video) {
            var vid = $("<a id='zb-pd-img' style='diplay: block; width:" + bw + "px; height: " + bh + "px;' href='" + cur_pic.video.url + "'></a>");
            if (autoPlay) {
        	video_playing = true;
            } else {
        	vid.html("<img src='" + cur_pic.imageSrc + "' width='" + bw + "' height='" + bh + "'>");
            }
            $("#zb-pd-picture").append(vid);
            flowplayer("zb-pd-img", {
	        src: $$.site.videoPlayer()
	    }, {
		key: '#$81a211045916ca9a22e',
		buffering: false,
		canvas: {
	            background: "#000000",
	            backgroundGradient: "none", 
	            border: "0 none"
	        },
	        screen: {         
	            top: 0, 
	            left: 0, 
	            width: bw, 
	            height: bh
	        },
	        clip : { 
	            scaling: "fit",
	            provider: "flvx",
	            onStart: function() {
	                video_playing = true;
	                hideComments();
	                $("#zb-pd-caption-edit .zb-pd-cancel").click();
	            },
	            onLastSecond: function() {
	        	video_playing = false;
	        	if (playing) resetTimer(500);
	            },
	            onFinish: function() {
	        	video_playing = false;
	            }
	        },
	        plugins: {
	            flvx: {
	                url: 'flowplayer.pseudostreaming-3.1.3.swf' 
	            },
	            controls: {
	                url: "flowplayer.controls-tube-3.1.5.swf",
	                autoHide: true,
	                hideDelay: 3000,
	                mute: false,	                
	                buttonOverColor: '#d9ddde',
	                volumeSliderColor: '#262626',
	                backgroundGradient: 'medium',
	                timeColor: '#11a8d4',
	                sliderGradient: 'none',
	                sliderColor: '#262626',
	                buttonColor: '#000000',
	                timeBgColor: '#262626',
	                durationColor: '#ffffff',
	                bufferGradient: 'none',
	                bufferColor: '#23424B',
	                progressColor: '#15b1e0',
	                progressGradient: 'none',
	                borderRadius: '0px',
	                tooltipTextColor: '#000000',
	                backgroundColor: '#000000',
	                volumeSliderGradient: 'none',
	                tooltipColor: '#C9C9C9',
	                bottom: 0,
	                height: 26,
	                opacity: 1.0
	           }
	        }
	    });
        } else {
            var img = $("<img id='zb-pd-img' src='" + cur_pic.imageSrc + "' width='" + bw + "' height='" + bh + "'>");        
            $("#zb-pd-picture").append(img);
        }
        hide_tools = false;
    }

    function stopVideo() {
	if (cur_pic.video) insertImage(false);
    }
    
    function handleContextChange() {
        var cls = "non-trip", cnxt = (search_result ? search_result.searchCnxt : null) || '';
        if (cnxt.match("^tripId:[0-9]+$")) {
            cls = "trip-one";
        } else {
            if (showall_shown) {
                if (search_result && search_result.trips.length == 1) {
                    cls = "trip-mix";
                }
            } else {
                if (cur_pic.contextType == 2) {
                    cls = "trip-mix";
                }
            }        
        } 
        $('#zb-pd-hdr').removeClass("trip-one trip-mix non-trip").addClass(cls);
    }
    
    function populateMenu(trip, isVideo) {
        handleContextChange();
        if (trip) {
            $('#zb-pd-menu-itinerary').attr('href', "Itinerary.page?tripId=" + trip.id).showhide(trip.itineraries != 0 || isEditor());
            $('#zb-pd-menu-journal').attr('href', "Journal.page?tripId=" + trip.id).showhide(trip.journalEntries != 0 || isEditor()).find('span');
            $('#zb-pd-menu-pictures').attr('href', "Picture.page?tripId=" + trip.id);
            $('#zb-pd-menu-cover2').attr('href', "Trip.page?tripId=" + trip.id).find('b').text($.abbreviate(trip.name, 25)).end().attr('title', (trip.name && trip.name.length > 25) ? trip.name : '');
        }
        $('#zb-pd-menu-share-photo>span:eq(2)').html("Share&nbsp;" + (isVideo ? "video" : "photo"));
        if (search_result) {
            var what;
            if (search_result.count == 1) {
                what = search_result.videoCnt ? "video" : "photo";
            } else {
                if (search_result.videoCnt == search_result.count) {
                    what = "videos";
                } else if (search_result.videoCnt == 0) {
                    what = "photos";                    
                } else {
                    what = "slideshow";
                }
            }
            $('#zb-pd-menu-share-slide>span:eq(2)').html("Share&nbsp;" + what);
        }
    }
    
    function populatePicbox(details, opts) {
        $$.notifications.clear();
        
        console.time("populate");
        if (!details) {
            details = {
                pictureId : 0,
                size : 'm',
                imageWidth : 500,
                imageHeight : 500,
                imageSrc : $$.rsrc('../images/missing-m-v2.gif')
            }
        }

        if (cur_pic.pictureId) {
            var txt = $.trim($('#zb-pd-cmnt-textarea').val());
            if (txt) {
                cmnts_dangling[cur_pic.pictureId] = txt;
            } else {
                delete cmnts_dangling[cur_pic.pictureId];
            }
        }

        cur_pic = details;
        if (!cur_pic.cmnts) cur_pic.cmnts = []; 
        var has_cmnts = cur_pic.cmnts.length > 0 && !cmnts_hide;
        var mis_pic = isMissingPicture();

        var autoPlay = cur_pic.video && !cur_pic.video.pending && !cur_pic.video.unavailable &&   
		       (playing || !(opts.next || opts.prev));
        insertImage(autoPlay);
        
        if (has_cmnts) {
            populateComments(cur_pic.cmnts);
            showComments();
        } else {
            if (cmnts_shown) hideComments();
            populateComments(cur_pic.cmnts);
        }
        notifyComments();

        showPrevNext();
        populateMenu(getTrip(cur_pic.contextId, cur_pic.contextType, cur_pic.contextName), cur_pic.video);

        $('#zb-pd-btns-box').removeClass('zb-pd-hide');
        var cls = 'zb-pd-btn-na', cmnts_notify = !cmnts_shown && cur_pic.cmnts.length > 0;
        $('#zb-pd-cmnts').onoffClass(cls, mis_pic || cur_pic.contextType == 10).onoffClass('zb-pd-notify', cmnts_notify);        
        $("#zb-pd-geo").onoffClass(cls, cur_pic.contextType != 2);
        $("#zb-pd-btns-sep,#zb-pd-privacy,#zb-pd-rotate-left,#zb-pd-rotate-right,#zb-pd-trash").onoffClass(cls, !isEditor());
        if (cur_pic.video) $("#zb-pd-rotate-left,#zb-pd-rotate-right").addClass(cls);
        
        notifyGeoBtn();
        refreshMapHilite();
        
        setPictureCaption(cur_pic.caption);

        var tagsBox = $('#zb-pd-tags').hide().empty();
        if (!cur_pic.video) {
            var tags = cur_pic.tags;
            if (tags && tags.length) {
                for ( var i = 0; i < tags.length; i++) {
                    createTag(tags[i], tagsBox);
                }
            }
            tagsBox.show();
            hide_tags = false;
        } else {
            hide_tags = true;
        }

        if ($('#zb-pd-info-box').length) populateInfo(cur_pic);
        positionToolbox();
        resetTimer();
        
        console.timeEnd("populate");
    }

    function refreshPicture() {
        var cnt = total_cnt();
        if (cnt == 0) {
            closePicbox('empty');
        } else  if (cur_index_invalid) {
            loadPicture( {
                index : Math.max(0, Math.min(cnt - 1, cur_index))
            });
        }        
    }
    
    function prepareInfo() {
        $('#zb-pd-page').append("<div id='zb-pd-info-box' class='shade-0b-85'></div>");
        var ps = page_size(), pw = ps.width, ph = ps.height, box = $('#zb-pd-info-box');
        box.hover(function() {
            $('#zb-pd-info-close').show();
        }, function() {
            $('#zb-pd-info-close').hide();
        }).click(function(e) {
            var t = $(e.target);

            if (t.is('#zb-pd-info-close')) {
                $(this).fadeOut('fast');
                info_shown = false;
                return false;
            } else if (t.is('#zb-pd-geolink')) {
                showMap(true);
                return false;
            } else if (t.is('#zb-pd-geomap')) {
                showMap(true, function(old_state, new_state) {
                    if (!old_state && new_state) setMapZoom();
                        mapPicture(picInfo(cur_index));
                });
                return false;
            } else if (t.is('#zb-pd-info-more')) {
                t.closest('tr').hide();
                box.data('extraInfo', true).find('.zb-pd-info-opt').css('display', '');
                $('#zb-pd-info-less').closest('tr').show();
                repositionInfo(box);
                return false;
            } else if (t.is('#zb-pd-info-less')) {
                t.closest('tr').hide();
                box.data('extraInfo', false).find('.zb-pd-info-opt').css('display', 'none');
                $('#zb-pd-info-more').closest('tr').show();
                repositionInfo(box);
                return false;
            } else if (t.is('#zb-pd-info-login')) {
                doLogin();
                return false;
            }
            if (t.is("#zb-pd-privacy")) {
                stopVideo();
        	showPrivacyBubble();
                return false;
            }
        }).Resizable({
            dragHandle : true,
            handlers : {
                se : empty_query
            },
            onDragStop : function() {
                box.data('info-bottom', box.top() + box.height() + 30);
            }
        }).css({
            left: 70, 
            top: ph - 210
        }).data('extraInfo', false);
        
        return box;
    }
    
    function repositionInfo(box) {
        if (!box) box = $('#zb-pd-info-box');
        var t = box.top(), h = box.height(), H = page_height(), bot = box.data('info-bottom') || (H - 10);
        box.top(bot - h - 30);
    }
    
    function populateInfo(pic) {
        var box = $('#zb-pd-info-box'), info = $("<div/>");
        info.append("<a id='zb-pd-info-close' class='global-icons' title='Hide info box' href='#'></a>");        
        if (pic.creationDate) {
            info.append($("<div id='zb-pd-info-date'></div>").text(pic.creationDate));
        }
        var base = $("<table id='zb-pd-info-base'/>");
        function row(label, data, cls, show) {
            var l = $("<td valign='top'/>").addClass('zb-pd-info-lbl').html(label);
            var d = $("<td valign='top'/>").html(data);
            base.append($('<tr/>').append(l).append(d).addClass(cls).css('display', show === false ? 'none' : ''));
            return d;
        }
        var d;
        switch (pic.contextType) {
            case 3: 
                d = $("<a/>").text(pic.contextName).attr("href", "Profile.page?userId=" + pic.contextId);
                row("From profile", d);
                break;
            case 2:
            case 10:
                d = $("<a/>").text(pic.contextName).attr("href", "Trip.page?tripId=" + pic.contextId);
                row("From trip", d);
                if (pic.uploaderId) {
                    d = $("<a/>").text(pic.uploaderName).attr("href", "Profile.page?userId=" + pic.uploaderId);
                    row("Uploaded by", d); 
                } 
                break;
        }
        if (pic.contextType != 3) {
            row("Geolocation", pic.latlng ? $("<a href='#' id='zb-pd-geolink'/>").html(pic.latlng) : pic.editor ? "<a href='#' id='zb-pd-geomap'>click to map it</a>" : "--");
        }
        d = pic.origWidth + " x " + pic.origHeight + " pixels<br />" + (loggedIn() ? "<a href='DownloadPicture.do?pictureId=" + pic.pictureId + "'>download</a> (" + pic.origSize + ")" : "<a href='#signin' onclick='return $$.site.login(this);' id='zb-pd-info-login'>login to download</a>");
        row("Size", d);
        if (isEditor()) {
            d = $("<a href='#' id='zb-pd-privacy'/>").text(pic.privacyName);
            row("Privacy", d);
        }
        info.append(base);
        
        var has_sep = false, exif = pic.exif || {}, extra = box.data('extraInfo');
        function opt(label, data) {
            if (!has_sep) {
                has_sep = true;
                d = row("", "<a href='#' id='zb-pd-info-more'>more</a>&nbsp;&darr;", '', !extra);
                d.addClass('zb-pd-info-more');
                d = row(' ', ' ', 'zb-pd-info-opt', extra);
                d.addClass('zb-pd-info-sep')
            }
            var d = row(label, '', 'zb-pd-info-opt', extra);
            d.text(data || '--');
        }
        function prgName(p) {
            switch (p) {
            case 1: return "Manual control";
            case 2: return "Program normal";
            case 3: return "Aperture priority";
            case 4: return "Shutter priority";
            case 5: return "Creative mode";
            case 6: return "Action mode";
            case 7: return "Portrait mode";
            case 8: return "Landscape mode";
            }
        }       
        opt("Camera", exif.model) 
        opt("Shutter", exif.speed) 
        opt("Aperture", exif.apr) 
        opt("Flash", exif.flash === true ? "On" : exif.flash === false ? "Off" : null) 
        opt("ISO", exif.iso) 
        opt("Exposure", prgName(exif.prg)) 
        opt("Focal length", exif.flen ? (exif.flen + 'mm') : null) 
        opt("File name", pic.origFile) 

        if (has_sep) {
            d = row("", "<a href='#' id='zb-pd-info-less'>less</a>&nbsp;&uarr;", '', extra);
            d.addClass('zb-pd-info-less');
        }
        
        box.html(info);
        
        repositionInfo(box);        
    }    

    function prepareSearch() {
        if ($('#zb-pd-search-box').length)
            return false;

        var srch = "<div id='zb-pd-search-box' style='display: none;'>"
                + "<a href='#' id='zb-pd-showall' class='zb-pd-btn-lg picbox-icons'></a>"
                + "<div id='zb-pd-search-content'></div>"
                + "<a href='#' id='zb-pd-pgup' class='zb-pd-btn-sm picbox-icons' style='margin: 6px 1px 0 0;'></a>"
                + "<a href='#' id='zb-pd-pgdn' class='zb-pd-btn-sm picbox-icons' style='margin: 6px 0 0;'></a>"
                + "</div>";
        $("#zb-pd-page").append(srch);
        $('#zb-pd-search-box').click(function(e) {
            var t = $(e.target);

            activityHandler(e);
            
            t.blur();

            if (t.is('#zb-pd-showall')) {
                showShowall();
                return false;
            }
            if (t.is('#zb-pd-pgup')) {
                scrollSearch(search_page_start - search_page_size);
                return false;
            }
            if (t.is('#zb-pd-pgdn')) {
                scrollSearch(search_page_start + search_page_size);
                return false;
            }
            var a = t.closest('.icon');
            if (a.length) {
                a.addClass('zb-pd-loading-pic');
                loadPicture( {
                    search : search_result,
                    index : parseInt(a.attr('picIndex'))
                }, function() {
                    a.removeClass('zb-pd-loading-pic');
                });
                return false;
            }
        }).mousewheel(function(e, delta) {
            activityHandler(e);
            scrollSearch(search_page_start - delta);
            return false;
        });
        
        return true;
    }

    function hiliteSearchIcon(auto) {
        var id = cur_pic.pictureId, l = $('#zb-pd-search-list'), key = 'selection', sid = l.data(key);
        var n = $("#zb-pd-srch-" + id).addClass("zb-icon-hilite");
        if (sid && sid != id) $("#zb-pd-srch-" + sid).removeClass("zb-icon-hilite");
        l.data(key, id);
        if (n.length && search_page_size) {
            var i = parseInt(n.attr('picIndex'));
            if (i < search_page_start || i >= search_page_start + search_page_size) {
                if (!(auto && playing && hoveredElement.closest('#zb-pd-search-box').length)) {
                     scrollSearch(parseInt(i / search_page_size) * search_page_size);
                }
            }
        }
    }
    
    function refreshSearchButtons() {
        var hu = search_page_start <= 0;
        var hd = search_page_start + search_page_size >= search_result.count;
        $('#zb-pd-pgup,#zb-pd-pgdn').showhide(!hu || !hd);
        $('#zb-pd-pgup').onoffClass('zb-disabled', hu);
        $('#zb-pd-pgdn').onoffClass('zb-disabled', hd);
    }    
    
    function scrollSearch(pos) {
        var i = Math.max(0, Math.min(pos, search_result.count - search_page_size));
        if (i != search_page_start) {
            $('#zb-pd-search-list').stop().animate({top: -i * 60}, 'fast');
            search_page_start = i;
        }
        refreshSearchButtons();
    }
    
    function draggableSearch() {
        $('#zb-pd-search-list > a').bind('dragstart', function(e) {
            return dragOverMapStart(e, $(this));
        }).bind('drag', dragOverMapDragging).bind('dragend', dragOverMapEnd);
    }
    
    function listSearch(listing, start, size) {
        for ( var i = start, j = 0; j < size + 1 && i < search_result.count; i++, j++) {
            var p = picInfo(i);
            var html = "<a href='#' id='zb-pd-srch-" + p.meta.id
                    + "' picIndex='" + i + "' class='icon'><img src='" + p.url
                    + "' ondragstart='return false' onselectstart='return false' onmousedown='if (event.preventDefault) event.preventDefault();'></a>";
            listing.append(html);
        }
        return listing;
    }
    
    function refillSearch() {
        $("#zb-pd-search-content").html(listSearch($("<div id='zb-pd-search-list'></div>"), 0, search_result.count));
        refreshSearchButtons();
        hiliteSearchIcon();
        if (google_map && search_result.editableCnt > 0) draggableSearch();
    }

    function pictureSearch(opts, cb) {
        $.ajax( {
            type : "GET",
            url : 'PictureSearch.do',
            data : {
                queryString : opts.searchContext
            },
            success : function(json) {
                handleSearchData(json, opts, cb);
            },
            error : function() {
                handleSearchData(null, opts, cb);
            },
            dataType : "json"
        });

        prepareSearch();
        return false;
    }

    function handleSearchData(json, opts, cb) {
        var lst = (json && json.pics) || [], cnt = lst.length;

        function setTitle() {
            setSlideshowTitle( (json && json.title) || ($.isFunction(opts.title) ? opts.title.apply(opts, [cnt]) : opts.title));            
        }
        function errMsg(msg) {
            if ($("#zb-pd-img").length) {
        	if (opts.forceTitle) setTitle();
        	notify(msg);
            } else {
                setTitle();
        	insertHtml(msg);
            }
        }        
        
        if (json == null) {
            errMsg(opts.errorMsg || "Search temporarily unavailable.");
        } else if (cnt == 0) {
            errMsg(opts.noImagesMsg || json.msg || "No photos or videos available");
        } else {
            function parseVideoMeta(meta) {                
                var p = meta.split(':');
                return {
                    unavailable: p[0].indexOf('n') > 0,
                    pending: p[0].indexOf('p') > 0,
                    w: parseInt(p[1]),
                    h: parseInt(p[2]),
                    url: p[3]
                };
            }
            for ( var i = 0; i < cnt; i++) {
                var p = lst[i].split((' '));
                lst[i] = {
                    sizes : p[0],
                    w : parseInt(p[1]),
                    h : parseInt(p[2]),
                    editor : p[3] == 'e',    
                    lat : p[4] == '-' ? null : parseFloat(p[4]),
                    lng : p[5] == '-' ? null : parseFloat(p[5]),
                    vid : p[6] == '-' ? null : parseVideoMeta(p[6]),
                    url : p[7],
                    meta : $$.pictures.infoFromURL(p[7])
                }
            }

            /* use the new search if it contains more than 2 elements or the existin one is a dud */
            if (cnt > 1 || (!search_result || search_result.pics.length < 2)) {
                /* cleanup old data first */
                if (search_result && search_result.pics) {
                    for ( var i in search_result.pics) {
                        cleanupPicture(search_result.pics[i]);
                    }
                }
                
                
                search_result = json;
                showall_populated = false;
                search_displayed = true;
                
                cur_index = -1;
                for ( var i = 0; i < cnt; i++) {
                    if (lst[i].meta.id == cur_pic.pictureId) {
                        cur_index = i;
                        cur_index_invalid = false;
                        break;
                    }
                }
                setTitle();
            }
            
            if (cnt == 1) {
                notify(opts.noOthersMsg);
            }
        }

        if (search_result && search_result.trips.length) {
            populateMenu(search_result.trips[0]);
        }

        if (!$("#zb-pd-img").length) {
            showShowall(true);
        }
        
        if ($("#zb-sall-box").visible()) {
            useSearchDataShowall(true);
        } else {
            useSearchDataMain(true);
        }
        setTimeout(populateMap, 100);
        
        if (cb) {
            cb.apply(this, [json, opts]);
        }
        
    }

    function useSearchDataMain(force) {
        playPause();
        showPrevNext();
        
        if (total_cnt() > 1) {
            if (prepareSearch() || force) {
                refillSearch();
            }
            if (!search_showing) {
                showSearch();
            }
            repositionSearch();
        } else {
            hideSearch();
        }

        activityHandler();
    }
    
    function showSearch(speed) {
        var b = $("#zb-pd-search-box");
        
        if (!b.length || total_cnt() < 2) return; 

        b.fadeIn(speed || 1);
        search_showing = true;
    }

    function hideSearch(speed) {
        $("#zb-pd-search-box").fadeOut(speed || 1);
        search_showing = false;
    }

    function repositionSearch() {
        if (total_cnt() < 2) {
            hideSearch();
            return;
        }
        var l = search_result.count, h = page_height() - 115;
        var os = search_page_size;
        var ns = Math.min(l, Math.max(1, parseInt(h / 60)));
        var oi = search_page_start;
        var ni = Math.max(0, Math.min(oi, l - ns));
        search_page_size = ns;
        $('#zb-pd-search-content').height(h);

        scrollSearch(ni);
    }

    function prepareShowall()
    {
        if ($('#zb-sall-box').length)
            return;

        var html = "<div id='zb-sall-box' style='display: none;'>"
                + "<div id='zb-sall-ctl'>"
                + "<a href='#' id='zb-sall-back' class='zb-sall-btn picbox-icons' title='Back to picture'></a>"
                + "<a href='#' id='zb-sall-play' class='zb-sall-btn zb-bb-btn picbox-icons' title='Start the slideshow'>"
                +   "<span class='zb-sall-play-icon picbox-icons'></span>"
                + "</a>"
                + "<div href='#' id='zb-sall-manage' class='zb-sall-btn picbox-icons' title='Manage photos and videos'></a>"
                +   "<div href='#' class='zb-sall-menu'>"
                +     "<a href='#' id='zb-sall-geotag' class='zb-sall-menuitem picbox-icons' title='Place photos and videos on the map'></a>"
                +     "<!--a href='#' id='zb-sall-reorg' class='zb-sall-menuitem picbox-icons' title='Re-order the photos and videos'></a-->"
                +     "<a href='#' id='zb-sall-del' class='zb-sall-menuitem picbox-icons' title='Delete some of the photos or videos'></a>"
                +   "</div>"
                + "</div>"
                + "<span id='zb-sall-size'><a href='#' id='zb-sall-small' class='zb-sall-btn picbox-icons'></a><a href='#' id='zb-sall-medium' class='zb-sall-btn picbox-icons selected'></a><a href='#' id='zb-sall-large' class='zb-sall-btn picbox-icons'></a></span>"                
                + "<a href='#' id='zb-sall-download-all' class='zb-sall-btn picbox-icons' title='Download all photos and videos'></a>"                
                + "</div>"
                + "<div id='zb-sall-scroll'><div id='zb-sall-content' class='zb-sall-medium'></div></div>"
                + "</div>", 
            sel, exit_cb, drop_cb;
        $("#zb-pd-page").append(html);
	
	//Hover action
        $("#zb-sall-manage").hover(function()
	{
            $(this).addClass('hover').find(".zb-sall-menu").show(); 
        }, function()
	{
            $(this).removeClass('hover').find(".zb-sall-menu").hide(); 
        });
	
	//Show all click action
        $('#zb-sall-box').click(function(e) 
	{
		var t = $(e.target);
		if (t.is('#zb-sall-back')) 
		{
			closeShowall();
			return false;
		}
		
		function selectSize(btn, sz) 
		{
			if (!btn.is('.selected')) 
			{
				populateShowall(sz);
			}
			return false;
		}
		function enterMultiSel(type, hint, drag, scb, ecb) 
		{
			$('#zb-sall-ctl').css('visibility', 'hidden');
			hint = hint + "<a href='#' id='zb-sall-exit'>done</a><div class='float-flush'></div>";
			$('#zb-sall-box').append($("<div id='zb-sall-hint'><div id='zb-sall-hint-body' class='fontsize1 zb-sall-hint-" + type + "'/></div>").find(">div").html(hint).end())
			$("#zb-sall-content").selectable({
			    filter: 'a.zb-pd-sall-editor',
			    draggable: drag
			}).bind('selectablechange', function(event, ui) {
			    sel = ui.sel;
			    if (scb) scb.apply(this, [sel])
			}).addClass("zb-sall-multisel");
			exit_cb = ecb;
			return false;
		}
		
		function exitMultiSel() 
		{
			$("#zb-sall-hint").fadeOut(function() { $(this).remove(); $('#zb-sall-ctl').css('visibility', ''); });
			$("#zb-sall-content").selectable('destroy').removeClass("zb-sall-multisel");
			if (search_result.count < 2) closeShowall();
			if (exit_cb) exit_cb.apply(this, []);
			exit_cb = null;
			return false;
		}
		
		function enterDragMode(cb) 
		{
			$("#zb-sall-content > .zb-pd-sall-editor").bind('dragstart', function(e) {
			    $("#zb-sall-content").selectable('cancel', e);
			    return dragOverMapStart(e, sel);
			}).bind('drag', dragOverMapDragging).bind('dragend', dragOverMapEnd);
			if (cb) $("#zb-pd-body").bind('ondrop', cb);
			drop_cb = cb;
		}
		
		function exitDragMode() 
		{
			$("#zb-sall-content .zb-pd-sall-editor").unbind('dragstart drag dragend');
			$("#zb-pd-body").bind('ondrop', drop_cb);
		}
            
		function getSelectedPictureIds() 
		{
			if (!sel || !sel.length)
				return [];
			var arr = new Array();
			sel.each(function() 
			{
				arr.push($(this).getOid());
			});
			return arr;
		}
		
		if (t.is('#zb-sall-small')) 
		{
			return selectSize(t, 'i');
		}
		
		if (t.is('#zb-sall-medium')) 
		{
			return selectSize(t, 's');
		}
		
		if (t.is('#zb-sall-large')) 
		{
			return selectSize(t, 'm');
		}
		
		if (t.is('#zb-sall-play')) 
		{
			loadPicture({
			index : 0
			}, function() {
			closeShowall();
			playStart(play_speed);
			});
			return false;
		}
	
		if (t.is('#zb-sall-geotag')) 
		{
			var hint = "<div class='zb-sall-hint-text'><b>Geotag photos/videos:</b> use Ctrl/Shift-Click to select photos/videos, then drag&amp;drop them on the map.</div>";
			enterMultiSel('geotag', hint, true, null, exitDragMode);
			enterDragMode(function (e) {
			    $("#zb-sall-content").selectable('clear', e);
			});
			showMap(true, function(old_state, new_state) {
			    if (!old_state && new_state) setMapZoom();
			});
			return false;
		}
		
		if (t.is('#zb-sall-reorg')) 
		{
			return false;
		}
		
		if (t.is('#zb-sall-del')) 
		{
			var hint = "<a href='#' id='zb-sall-del-do' class='zb-sall-btn-do' style='display: none;'>delete</a><div class='zb-sall-hint-text'><b>Delete photos/videos:</b> use Ctrl/Shift-Click to select the photos or videos to delete</div>";
			return enterMultiSel('delete', hint, false, function(sel) {
			$('#zb-sall-del-do').css('display', sel && sel.length ? 'block' : 'none');
			});
		}
		
		if (t.is('#zb-sall-exit')) 
		{
			return exitMultiSel();
		}
	
		if (t.is('#zb-sall-del-do')) 
		{
			deletePictures(getSelectedPictureIds(), function() {
			refreshShowallManage();
                        exitMultiSel();
			});
			$("#zb-sall-hint-body").html("<em>Deleting photos/videos....</em>");
			return false;
		}
		
		if (t.is('#zb-sall-download-all')) 
		{
			$.zipBox.show("DownloadAllBox.clip", {
			    queryString: search_result.searchCnxt,
			    title: $('#zb-pd-title').text() 
			}, { 
			    type: 'bubble',
			    nozzle: { 
				dir: 'up',
				offset: -30,
				element: $('#zb-sall-download-all')
			    }
			});
			return false;
		}
		
		var a = t.closest('a');
		if (a.length && !$("#zb-sall-content").is('.zb-sall-multisel')) 
		{
			a.addClass('zb-pd-loading-pic');
			loadPicture({
			    search : search_result,
			    index : parseInt(a.attr('picIndex'))
			}, function() {
			    a.removeClass('zb-pd-loading-pic');
			    closeShowall();
			});
			return false;
		}
            return false;
        });
	//alert(sz);
    }

    function refreshShowallManage() {
        $('#zb-sall-manage').showhide(search_result.editableCnt);
    }
    
    function buildIconShowall(p, i, sz) 
    {
        var w = p.w, h = p.h, r = showall_info[sz];

        if (sz != 'i') 
	{                
		var f = Math.min(r.l/w, r.l/h);
		if (f < 1.0)
		{
                w = parseInt(w*f);
                h = parseInt(h*f);
		}
        }
	else 
	{
            w = h = r.l;
        }
	//Remove the autogessPicUrl we dont need it right now
        //return "<a href='#' id='zb-pd-sall-" + p.meta.id + "' picIndex='" + i + "' class='" + (p.editor ? "zb-pd-sall-editor" : "zb-pd-sall-noned") + "'><img src='" + autogessPicUrl(p, sz) + "' width='" + w + "' height='" + h + "'></a>";
	return "<a href='#' id='zb-pd-sall-" + p.meta.id + "' picIndex='" + i + "' class='" + (p.editor ? "zb-pd-sall-editor" : "zb-pd-sall-noned") + "'><img src='./Zipalong - Slideshow_files/spacer.gif' width='" + w + "' height='" + h + "'></a>";
    }
    
    function populateShowall(sz)
    {
        if (!search_result) return;

        /* make sure the hourglass is loaded */
        var preld = new Image();
        preld.src = $$.rsrc("../images/hourglass.gif");
        
        /* prepare the container */ 
        var c = $('#zb-sall-content'), r = showall_info[sz];
        if (!c.is('.' + r.cls)) {
            c.removeClass('zb-sall-small zb-sall-medium zb-sall-large').addClass(r.cls);
            $('#zb-sall-size a').removeClass('selected');
            $('#' + r.cls).addClass('selected');
        }
        refreshShowallManage();
        
        var icons = new Array();
        for ( var i = 0; i < search_result.count; i++) 
	{
            icons.push(buildIconShowall(search_result.pics[i], i, sz));
        }

        c.html(icons.join(''));
        showall_size = sz;
        showall_populated = true;
	
    }

    function invalidateShowallIcon(p) {
	var icon = $("#zb-pd-sall-" + p.meta.id);
	if (icon.length) {
	    icon.replaceWith(buildIconShowall(p, parseInt(icon.attr('picIndex')), showall_size));
	}
    }
    
    function useSearchDataShowall() 
    {
	
        if (!showall_populated)
            populateShowall(showall_size);
        $("#zb-sall-back").css('display', cur_pic.pictureId ? '' : 'none');
        $("#zb-sall-box").show().data('selection', cur_pic.pictureId);
        $("#zb-pd-sall-" + cur_pic.pictureId).addClass("zb-icon-hilite");
    }
    
    function repositionShowall() {
        $('#zb-sall-scroll').height(page_height() - 55 - 12 - 24);
    }

    function showShowall(direct){
	// first pause the video, if any
	var p = flowplayer();
	if (p) p.pause();
	prepareShowall();
        repositionShowall();
        useSearchDataShowall();
        if(direct) $('#zb-sall-ctl').addClass('zb-sall-direct');
        $('#zb-pd-notmapped').hide();
        showall_shown = true;

        $(document).unbind("keydown", navigationKeyHandler).keydown(showallKeyHandler);
        
        $("#zb-pd-img").hide();
        $("#zb-pd-page").addClass("show-all");
	
	populateImageObjects(showall_size);
	    
	$('#zb-sall-scroll').bind('scrollstop', function(){
		displayImages(showall_size);
	});
	
    }


    function displayImages(sz){
	    
		var top = $('#zb-sall-scroll').scrollTop();
		var height = $('#zb-sall-scroll').height();
	
		for ( var i = 0; i < imagesLayout.length; i++){
			var row = imagesLayout[i];

			if ( top <= row.top && row.top <= top+height && row.show == false){
				row.show = true;
				for ( var j = 0; j < row.cols.length; j++){
					var url = autogessPicUrl(search_result.pics[row.cols[j].index], sz);
					$('#img-'+row.cols[j].index).attr('src',url);
				}
				
			}
		}
    }
    
    function populateImageObjects(sz){
	    
	var image_tags = $("#zb-sall-content > a > img");

	
	imagesLayout = [];
	var insert_images = true;
	var row_images = [];
	var row_top = 32000;
	var row_height = 0 ;
	var row_width = 0;
	var row_image = {};
		
	image_tags.each(function(index) {
		
		var position = $(this).position();
		var height = $(this).attr( "height" );
		var width = $(this).attr( "width" );
		
		if ( index > 0 &&  !insert_images )
			row_images.push(row_image);
		if ( insert_images ){
			if (  index > 0){
				var row = {
					'top' :  row_top,
					'width' : row_width,
					'height' : row_height,
					'show' : false,
					'cols' : row_images
				}
				imagesLayout.push(row);
			}
			
			//initalize for new line
			row_images = [];
			row_top = position.top;
			row_height = 0 ;
			row_width = 0;
		}
		if ( index > 0 &&  insert_images )
			row_images.push(row_image);
		
		row_width += width;
		
		//Check if we have to insert a new row
		if (  position.top > row_top+row_height )
			insert_images = true;
		else
			insert_images = false;
		if ( position.top < row_top)
			row_top = position.top;
		if ( height > row_height)
			row_height = height;
		
		$(this).attr( "id",'img-'+index );
		row_image = {
			"left" : position.left,
			"top" : position.top,
			"index" : index,
			"width" : width,
			"height"  : height
		}
		
	});	
	
	row_images.push(row_image);
	var row = {
		'top' :  row_top,
		'width' : row_width,
		'height' : row_height,
		'show' : 'false',
		'cols' : row_images
	}
	imagesLayout.push(row);
	
	//call the display images method to show the visible lines
	displayImages(sz);
    }
    
    
    function closeShowall() {
        var sel = $("#zb-sall-box").hide().data('selection');
        $("#zb-pd-sall-" + sel).removeClass("zb-icon-hilite");
        $('#zb-sall-ctl').removeClass('zb-sall-direct');
        $("#zb-pd-page").removeClass("show-all");
        $('#zb-pd-notmapped').show();
        $("#zb-pd-img").show();
        showall_shown = false;
        
        useSearchDataMain(false);
        refreshPicture();
        refreshMapHilite();
        
        $(document).unbind("keydown", showallKeyHandler).keydown(navigationKeyHandler);
    }

    function handleTimer() {
        if (cur_pic.tagEditing || showall_shown || $('#zb-pd-caption-textarea').length || $.zipBox.visible()) {
            playTid = setTimeout(handleTimer, 1000);
        } else if (!video_playing) {
            playTid = null;
            if (playing) {
                showNext(true);
            }
        }
    }
    function resetTimer(speed) {
        if (playTid)
            clearTimeout(playTid);
        playTid = null;
        if (playing) {
            playTid = setTimeout(handleTimer, speed || play_speed);
        }
    }

    function playMsg(msg) {
        msg = msg || ("change every " + (play_speed/1000) + "s");
        var d = $('#zb-pd-play-hint').html(msg).stop()
        d.css({marginLeft: -d.width()/2 - 20, opacity: ''});
        d.fadeIn('fast').pause(2000).fadeOut('fast');
    }
    function playStart(speed) {
        if (playing || search_result.count < 2) return;
	$('#zb-pd-play').hide();
        $('#zb-pd-pause').show();
        playMsg("use &uarr; &darr; for speed");
        playing = true;
        resetTimer(speed || 250);
    }

    function playPause() {
        if (!playing) return;
	$('#zb-pd-pause').hide();
        $('#zb-pd-play').show();
        $('#zb-pd-play-hint').stop().hide();
        playing = false;
        resetTimer();
    }

    function playFaster() {
        if (playing) {
            play_speed = Math.max(1000, play_speed - 1000);
            resetTimer();
            playMsg();
        }
    }
    function playSlower() {
        if (playing) {
            play_speed = Math.min(6000, play_speed + 1000);
            resetTimer();
            playMsg();
        }
    }
    
    function autogessPicUrl(pic, sz) {
        if (!pic)
            return;
        var s = sz || pref_size, ss = pic.sizes;
        if (ss && ss.indexOf(s) < 0) {
            if (ss.indexOf('l') >= 0)
                s = 'l';
            else if (ss.indexOf('m') >= 0)
                s = 'm';
            else if (ss.indexOf('s') >= 0)
                s = 's';
            else if (ss.indexOf('t') >= 0)
                s = 't';
            else
                s = 'i';
        }
        var l = $$.pictures.urlBySize(pic, s);
	return "./Zipalong - Slideshow_files/" + l.substring(l.lastIndexOf('/') + 1);
    }

    function showPrev() {
        var cnt = total_cnt();
        function prev(i) {
            return i <= 0 ? cnt + i - 1 : i - 1;
        }
        if (cnt > 1) {
            var i = prev(cur_index);
            loadPicture( {
                index : i,
                preload : cnt > 2 ? prev(i) : null,
                prev : true
            });
        }
    }
    function showNext(auto) {
        if (auto && loading_in_progress) return;
        
        var cnt = total_cnt();
        function next(i) {
            return i + 1 >= cnt ? i - cnt + 1 : i + 1;
        }
        if (cnt > 1) {
            var i = next(cur_index);
            loadPicture({
                index : i,
                auto: auto,
                preload : cnt > 2 ? next(i) : null,
                next: true
            });
        }
    }

    function deletePictures(picIds, cb) {
        var hint;
        if (picIds.length == 0) return;
        if (picIds.length == 1) hint = "Delete the selected photo/video?";
        else hint = "Delete the " + picIds.length + " selected photos/videos?";
        if (!confirm(hint)) return;        
        $.ajax({
            type: "POST",
            url: "DeletePictures.do",
            data: {
                pictureIds: picIds.join()
            },
            success: function(json) {
                for (var i in json.ids) {
                    deletePicture(json.ids[i], true);
                }
                if (cb) cb.apply(this, [json]);
                ready();
            },
            error: function() {
                ready();
            },
            dataType: "json"
        });
        
    }
    
    function deletePicture(picId, localOnly) {
        var cur = (picId == cur_pic.pictureId);
        if (cur) {
            $("#zb-pd-img").remove();
        }
        if (!localOnly) {
            $.get("DeletePicture.do", {
                pictureId : picId
            });
        }

        var i = getPictureIndex(picId);
        if (i >= 0) {
            cleanupPicture(picInfo(i));            
            search_result.pics.splice(i, 1);
            search_result.count--;
            search_result.editableCnt--;
        }
        var pic = $("#zb-pd-srch-" + picId);
        if (pic.length) {
            pic.remove();
            repositionSearch();
        }
        $("#zb-pd-sall-" + picId).remove();
        if (cur) cur_index_invalid = true;
        if (!localOnly) {
            refreshPicture();
        }

        $(document).trigger( {
            type : "pic-del.zip",
            picId : picId
        });
        
        return cur;
    }
      
    
    function cleanupPicture(p) {
        if (p && p.marker) {
              GEvent.clearInstanceListeners(p.marker);
                delete p.marker.__zip_meta;
            delete p.marker;
        }
    }
    
    function loadPicture(opts, callback) {
        if (cur_pic.tagEditing) {
            exitTaggingMode();
        }
        opts = opts || {};
        var id = opts.id, index = opts.index, search = (opts.search || search_result), pic = opts.pic;
        if (id && !(index >= 0)) {
            index = getPictureIndex(id);
        }

        if (!pic && search && index >= 0) {
            pic = search.pics[index];
        }
        if (!id && pic)
            id = pic.meta.id;
        if (!id)
            id = cur_pic.pictureId;
        if (!id)
            return;

        cur_request_id++;
        var reqId = cur_request_id, tries = 0;
        thinking();
        loading_in_progress = true;
        $.getJSON("PictureDetailsJson.do", {
            pictureId : id,
            size : pref_size
        }, function(json) {

            var details = json.details;
            if (!details) {
                ready();
                return;
            }

            var imgPreloader = new Image();
            imgPreloader.onload = function() {
                imgPreloader.onload = null;
                ready();
                loading_in_progress = false;
                if (reqId == cur_request_id) {
                    var oldId = cur_pic.pictureId;
                    if (index >= 0) {
                        cur_index = index;
                        cur_index_invalid = false;
                    }
                    if (opts.search) {
                        search_result = opts.search;
                    }
                    showPrevNext();

                    populatePicbox(details, opts);
                    hiliteSearchIcon(opts.auto);
                    if (callback)
                        callback.apply(opts);
                }
            };
            imgPreloader.onerror = function() {
                ready();
                loading_in_progress = false;
                if (tries++ > max_pic_load_retries)
                    return;
                details.imageSrc = $$.rsrc('../images/missing-l-v2.gif');
                imgPreloader.src = details.imageSrc;
            };
            imgPreloader.src = details.imageSrc;
        });

        // preload the images if we can
        if (pic) {
            var img = new Image(), n = opts.preload;
            if (n >= 0 && search) {
                function done() {
                    img.onload = img.onerror = null;
                    var u = autogessPicUrl(search.pics[n]);
                    if (u)
                        img.src = u;
                }
                img.onload = img.onerror = done;
            }
            var u = autogessPicUrl(pic);
            if (u)
                img.src = u;
        }
    }

    function showExtras(speed, onActivity) {
        if (!cmnts_hide && cur_pic.cmnts.length > 0) showComments(speed);
        if (search_displayed) showSearch(speed);
        var toShow =  $("#zb-pd-hdr"), cap = $("#zb-pd-caption");
        if (!hide_tools) {
            toShow = toShow.add($("#zb-pd-btns-box"));
            if (!cap.is('.zb-pd-caption-hide')) toShow = toShow.add(cap);
        }
        if (!hide_tags) toShow = toShow.add($("#zb-pd-tags"));
        toShow.fadeIn(speed || 1);

        $('#zb-pd-btns-box').removeClass('zb-pd-btns-simple');
        $('#zb-pd-cmnts-notify').hide();
        
        extras_hidden = false;
    }

    function hideExtras(speed, onInactivity) {
        $$.notifications.clear();

        if (!onInactivity) hideComments(speed);

        hideSearch(speed);
        var toHide;
        if($("body>.hdr-search-box:visible,body>.hdr-more:visible").length) {
            toHide = $("#zb-pd-tags"); 
        } else {
            toHide = $("#zb-pd-tags,#zb-pd-hdr");
        }
        
        cap = $("#zb-pd-caption");
        if (!onPrevNext) toHide = toHide.add("#zb-pd-btns-box");
        if (cap.is('.zb-pd-caption-empty')) toHide = toHide.add(cap);
        toHide.fadeOut(speed || 1, function() {
            notifyComments();
        });

        if (onPrevNext) $('#zb-pd-btns-box').addClass('zb-pd-btns-simple');
        
        extras_hidden = true;
    }
    
    function setPictureCaption(data) {
        data = data || ''; /* fix for IE 6/7 */
        cur_pic.caption = data;
        
        var cap = $("#zb-pd-caption");
        if (!isEditor() && !data) {
            cap.hide().addClass("zb-pd-caption-hide");
            return;
        }
        
        cap.removeClass("zb-pd-caption-hide");
        var span = $("<div id='zb-pd-caption-edit'></div>").text(data || '');
        cap.html(!data ? span : span.html(span.html().replace(/\n/g, '<br>')));
        if (cap.width() > 350) cap.width(350);
        
        cap.showhide(!extras_hidden || data);
        
        if (!isEditor()) return;
        
        $("#zb-pd-caption-edit").click(function(e) {
            stopVideo();
        });
        
        $("#zb-pd-caption-edit").editable(function(value, settings) {
            $.ajax({
                type: "POST",
                url: "SetPictureCaption.do", 
                data: {
                    id: cur_pic.pictureId,
                    value: value
                },
                success: function(str) {
                	//FIXME -- cannot figure out why jquery does it, but it fails to return what the server sends
                	//use the valu instead, it's success anyways
                    //setPictureCaption(str);
                	setPictureCaption(value);
                	//
                    $(document).trigger({type: "pic-caption.zip", picId: cur_pic.pictureId});
                },
                error: function() {
                    self.innerHTML = self.revert;
                }

            });
            return settings.indicator;
        }, {
            indicator : "Saving...",
            tooltip   : 'Click here to edit the caption',
            cssclass  : "zb-pd-caption-form",
            width     : 'none',
            height    : 'none',
            onblur    : 'ignore',
            type      : 'textarea',
            rows      : 4,
            cols      : 30,
            placeholder : "<em class='fontsize1'>Click to edit caption</em>",
            data      : function() { 
                return data; 
            },
            element : function(settings, original) {
                var textarea = $("<textarea id='zb-pd-caption-textarea' rows='4' cols='30' class='shade-comment fontsize3'>");
                $(this).append(textarea);
                return(textarea);
            },
            buttons : function(settings, original) {
                var self = $(this);
                var btns = $("<div class='zb-pd-caption-buttons fontsize1'></div>");
                var submit = $("<a href='#' class='zb-pd-save btn'>Save</a>");
                btns.append(submit);
                submit.click(function() {
                    self.submit();
                    resetTimer();
                    return false;                    
                }).ctrlEnterIn(self.find('textarea'));
                
                var cancel = $("<a href='#' class='zb-pd-cancel'>Cancel</a>");
                btns.append(cancel);
                $(cancel).click(function() {
                    $(original).html(original.revert);
                    original.editing = false;
                    return false;
                });

                self.append(btns);
            }
        }).css('cursor', 'pointer');
        $('#zb-pd-caption').onoffClass('zb-pd-caption-empty', !data);
    }

    function getTag(tagId, newTag) {
        if (!tagId)
            return null;
        for (i = 0; i < cur_pic.tags.length; i++) {
            if (cur_pic.tags[i].id == tagId) {
                if (newTag)
                    cur_pic.tags[i] = newTag;
                return cur_pic.tags[i];
            }
        }
        return null;
    }

    function picInfo(i) {
        return search_result && search_result.pics && search_result.pics[i];
    }
    
    function getPictureIndex(picId) {
        var pics = (search_result && search_result.pics) || [];
        for ( var i = 0; i < pics.length; i++) {
            if (pics[i].meta.id == picId) {
                return i;
            }
        }
    }
    
    function searchByTag(tagid) {
        return pictureSearch( {
            searchMsg : "Searching for similary tagged photos ...",
            noImagesMsg : "No similary tagged photos found.",
            noOthersMsg : "No other photos with this tag.", 
            searchContext : "tagId:" + tagid
        });
    }

    function createTag(tag, area) {
        $('#zb-pd-no-tags').remove();

        var txt = tag.tagText || '';
        var authName = $.abbreviate(tag.authorName, 25);
        if (tag.width && tag.height) {
            var imageWidth = cur_pic.imageWidth;
            var imageHeight = cur_pic.imageHeight;

            var tagEl = $("<div id='zb-pd-tag-rect-"
                    + tag.id
                    + "' class='zb-pd-tag-rect'><div class='zb-pd-bevel'></div></div>");
            if (txt)
                tagEl.attr('title', txt);
            var tagCtl = $("<div id='zb-pd-tag-lbl-"  + tag.id + "' class='zb-pd-tag-lbl'></div>");
            var row1 = $("<div class='zb-pd-tag-row1 shade30'></div>");
            if (tag.tagType == 1 && tag.idRef) {
                row1.append($("<a href='Profile.page?userId="
                        + tag.idRef
                        + "' class='zb-pd-tag-txt' title=\"Visit user's profile page\"></a>")
                          .text($.abbreviate(txt, 250)));
            } else {
                row1.append($("<span class='zb-pd-tag-txt'></span>").text($.abbreviate(txt, 50)));
            }
            if (tag.approved) {
                row1.append($("<span class='zp-pd-tag-auth'>by </span>")
                                .append($("<a href='Profile.page?userId="
                                              + tag.authorId
                                              + "' class='user-link' title=\"Visit user's profile page\"></a>")
                                                .text(authName)));
            } else {
                row1.append("<span class='zp-pd-tag-auth'><em>pending approval</em></span>");
            }
            tagCtl.append(row1);
            var tools = $("<div class='zb-pd-tag-tools fontsize0 shade30'></div>");
            tools.append("<a href='#' class='zp-pd-tag-search' title='Search for this tag in other photos'>search</a>");
            if (isEditor()) {
                tools.append("&nbsp;&nbsp;<a href='#' class='zp-pd-tag-edit' title='Edit this tag'>edit</a>");
            }
            if (viewerCanDeletePictureTag(tag)) {
                tools.append("&nbsp;&nbsp;<a href='#' class='zp-pd-tag-rm' title='Remove this tag'>remove</a>");
            }
            tagCtl.append(tools);
            tagEl.css( {
                'left' : tag.xPos*100 + '%',
                'top' : tag.yPos*100 + '%',
                'width' : tag.width*100 + '%',
                'height' : tag.height*100 + '%'
            });
            tagCtl.css( {
                'left' : tag.xPos*100 + '%',
                'top' : (tag.yPos + tag.height + 6/imageHeight)*100 + '%'
            });
            (area || $('#zb-pd-tags')).append(tagEl).append(tagCtl);
        }

    }

    function removeTag(tagId) {
        $("#zb-pd-tag-rect-" + tagId + ",#zb-pd-tag-lbl-" + tagId).remove();
    }

    function hiliteTag(tagId, hilite) {
        $("#zb-pd-tag-rect-" + tagId).onoffClass("zb-pd-tag-rect-hilight", hilite);
        $("#zb-pd-tag-lbl-" + tagId)
                .onoffClass("zb-pd-tag-lbl-hilight", hilite)
                .find('.zb-pd-tag-row1,.zb-pd-tag-tools').onoffClass('shade80', hilite).end()
                .find('.zp-pd-tag-auth,.zb-pd-tag-tools').showhide(hilite);
    }

    function getSelectedTagType() {
        return $("#zb-pd-tag-box input[name=type]:checked").val();
    }

    function prepareTaggingDlg() {
        if ($('#zb-pd-tag-box').length) return;
        
        var html = "<div id='zb-pd-tag-box' class='shade-0b-85'>" +
            "<div id='zb-pd-tag-edit'>" +
                "<div class='zb-pd-tag-edit-area' style='margin-top: 0'>" +
                    "<label class='zb-pd-tag-type'><input name='type' value='1' type='radio'>Person</label>" +
                    "<div id='zb-pd-tag-body-1' class='zb-pd-tag-edit-body'>" +
                        "<input id='zb-pd-tag-text-by-type-1' size='15' type='text'>" +
                        "<div id='zb-pd-tag-pic-1'><img src='" + $$.rsrc('../images/transp.gif') + "' width='75' height='75'/></div>" +
                        "<p id='zb-no-id-tag-1' style='display: none; margin: 5px 0 0 20px;'>This is not a Zipalong user; it is a text-only tag.</p>" +
                    "</div>" +
                "</div>" +
                "<div id='zb-pd-tag-edit-area-landmark' class='zb-pd-tag-edit-area'>" +
                    "<label class='zb-pd-tag-type'><input name='type' value='3' type='radio'>Landmark</label>" +
                    "<div id='zb-pd-tag-body-3' class='zb-pd-tag-edit-body'>" +
                        "<input id='zb-pd-tag-text-by-type-3' size='15' type='text'>" +
                        "<div id='zb-pd-tag-pic-3'><img src='" + $$.rsrc('../images/transp.gif') + "' width='75' height='75'/></div>" +
                        "<p id='zb-no-id-tag-3' style='display: none; margin: 5px 0 0 20px;'></p>" +
                    "</div>" +
                "</div>" +
                "<div class='zb-pd-tag-edit-area'>" +
                    "<label class='zb-pd-tag-type'><input name='type' value='0' type='radio'>Other</label>" +
                    "<div id='zb-pd-tag-body-0' class='zb-pd-tag-edit-body'>" +
                        "<input id='zb-pd-tag-text-by-type-0' size='15' type='text'>" +
                    "</div>" +
                "</div>" +
                "<div class='zb-pd-tag-buttons'>" +
                    "<a href='#' class='zb-pd-save btn'>Save tag</a><a href='#' class='zb-pd-cancel'>Cancel</a>" +
                "</div>" +
            "</div>" +
        "</div>";
        
        $('#zb-pd-page').append(html);

        $("#zb-pd-tag-box").click(function(e) {
            var t = $(e.target);
            if (t.is('.zb-pd-save')) {
                saveTag();
                return false;
            } else if (t.is('.zb-pd-cancel')) {
                exitTaggingMode();
                return false;
            }
        });
        $("#zb-pd-tag-box input[name=type]").change(function(e) {
            selectTagType(getSelectedTagType());
        });
        $.each( [ 1, 3 ], function(i, n) {
            $('#zb-pd-tag-text-by-type-' + n).autocomplete('GetAutocompletion.do', {
                delay : 200,
                selectFirst : false,
                highlight : false,
                matchSubset : false,
                cacheLength : 1,
                max : 10,
                extraParams : {
                    tagType : n,
                    pictureId : function() {
                        return cur_pic.pictureId;
                    }
                }
            }).result(function(event, data, value) {
                cur_pic.idRef = data[1];
                $("#zb-pd-tag-pic-" + n).attr("idRef",
                        data[1] || '').find("> img").attr("src",
                        data[2]);
                showTagInfo(n);
            });
        });
    }
    
    function enterTaggingMode(e, tagId) {
        var tag = tagId ? getTag(tagId) : null;
        if (!viewerId) {
            alert("You need to login to tag photos.");
            return false;
        }
        if (isMissingPicture()) {
            alert("Cannot create tags for a missing photo.");
            return false;
        }

        if (!isEditor() && tag) {
            return false;
        }

        var speed = 'fast';
        hideExtras(speed);

        var rect = $("<div id='zb-pd-tag-rect'><div class='zb-pd-bevel'></div><div id='zb-pd-tag-handle' class='misc-icons'></div></div>");
        $('#zb-pd-picture').append(rect);

        var imageWidth = cur_pic.imageWidth, imageHeight = cur_pic.imageHeight;
        var ib = $('#zb-pd-picture'), iw = ib.width(), ih = ib.height();
        var width, height, left, top;
        
        if (tag) {
            left = tag.xPos * imageWidth;
            top = tag.yPos * imageHeight;
            width = Math.min(imageWidth, tag.width * imageWidth);
            height = Math.min(imageHeight, tag.height * imageHeight);
        } else {
            var coords = getRelativePosition(e.originalEvent);
            width = Math.min(imageWidth - 2, 100);
            height = Math.min(imageHeight - 2, 100);;
            left = Math.max(coords.x * imageWidth / iw - width / 2, 0);
            top = Math.max(coords.y * imageHeight / ih - height / 2, 0);
        }
        if (left + width > imageWidth)
            left = imageWidth - width;
        if (top + height > imageHeight)
            top = imageHeight - height;

        var x = left / imageWidth * iw, y = top / imageHeight * ih;
        rect.css({
            left: x,
            top: y,
            width: width * iw / imageWidth,
            height: height * ih /imageHeight
        });

        rect.Resizable( {
            minWidth : 30,
            minHeight : 30,
            maxWidth : iw - 2,
            maxHeight : ih - 2,
            minTop : 1,
            minLeft : 1,
            maxRight : iw - 3,
            maxBottom : ih - 3,
            dragHandle : true,
            handlers : {
                se : '#zb-pd-tag-handle'
            }
        });

        prepareTaggingDlg();
        
        //show landmark tagging only in trip pics
        $("#zb-pd-tag-edit-area-landmark").showhide(cur_pic.contextType == 2);

        $.each( [ 0, 1, 2, 3 ], function(i, n) {
            $("#zb-pd-tag-text-by-type-" + n).val('');
            $("#zb-pd-tag-pic-" + n).attr("idRef", '').attr("origIdRef", '')
                    .hide().find(">img").attr("src", $$.rsrc("../images/transp.gif"));
            $("#zb-pd-tag-body-" + n).css('display', 'none');
        });
        cur_pic.idRef = null;
        var tagType;
        if (tagId) {
            var tag = getTag(tagId);
            if (tag == null)
                return;
            tagType = tag.tagType;
            $("#zb-pd-tag-text-by-type-" + tag.tagType).val(tag.tagText);
            $("#zb-pd-tag-pic-" + tag.tagType).attr("idRef", tag.idRef || '')
                    .attr("origIdRef", tag.idRef || '').find(">img").attr(
                            "src", $$.rsrc("../images/transp.gif"));

            if (tag.tagType > 0) {
                guessPictureTag(tag.tagType);
            }
        } else {
            tagType = getSelectedTagType() || 1;
        }
        $(document).unbind("keydown", navigationKeyHandler);
        $(document).keydown(taggingModeKeyHandler);

        selectTagType(tagType, true);

        var mb = $('#zb-pd-main-box'), a = 0, b = 0;
        var rx = mb.left() + a + x, ry = mb.top() + b + y;  
        var ps = page_size(), pw = ps.width, ph = ps.height;
        $("#zb-pd-tag-box").fadeIn(speed).Resizable({
            minTop : 1,
            minLeft : 1,
            maxRight : pw,
            maxBottom : ph,
            dragHandle : true,
            handlers : {
                se : empty_query
            },
            onDragStart : function() {
                $.each( [ 0, 1, 2, 3 ], function(i, n) {
                    $('#zb-pd-tag-text-by-type-' + n).blur();
                });
            }
        }).css({
            left: rx > 220 ? Math.max(0, rx - 220) : Math.max(0, Math.min(pw - 220, rx + 150)), 
            top: Math.max(0, Math.min(ry - 15, ph - 240))
        });
        cur_pic.tagEditId = tagId;
        cur_pic.tagEditing = true;
        $("#zb-pd-picture").addClass("zb-pd-mapping-mode");
        var e = $("#zb-pd-tag-text-by-type-" + tagType);
        if (e.size() > 0) {
            e[0].focus();
        }
        cur_pic.tagDataReady = true;

        return false;
    }

    function taggingModeKeyHandler(event) {
        var keyCodes = {
            13 : 1,
            27 : 1,
            33 : 1,
            34 : 1,
            9 : 1
        };
        // var typeOrder = [1, 2, 3, 0];
        var typeOrder = (cur_pic.contextType != 2) ? [ 1, 0 ] : [ 1, 3, 0 ];

        if (keyCodes[event.keyCode]) {
            event.stopPropagation();
            event.preventDefault();
        }
        var tagType = getSelectedTagType();
        var tagTypeIndex;
        for (i = 0; i < typeOrder.length; i++) {
            if (typeOrder[i] == tagType) {
                tagTypeIndex = i;
                break;
            }
        }
        switch (event.keyCode) {
        case 13: /* ENTER */
            saveTag();
            break;
        case 27: /* ESC */
            exitTaggingMode();
            break;
        case 33: /* PAGE UP */
            selectTagType(typeOrder[tagTypeIndex > 0 ? tagTypeIndex - 1 : 0]);
            break;
        case 34: /* PAGE_DOWN */
            selectTagType(typeOrder[Math.min(tagTypeIndex + 1,
                    typeOrder.length - 1)]);
            break;
        case 9: /* TAB */
            selectTagType(typeOrder[tagTypeIndex + 1 >= typeOrder.length ? 0
                    : tagTypeIndex + 1]);
            break;
        default:
            if (!auto_fill_tid && tagType > 0) {
                auto_fill_tid = setTimeout( function() {
                    auto_fill_tid = null;
                    guessPictureTag(getSelectedTagType());
                }, 500);
            }
            return;
        }
        return false;
    }

    function showallKeyHandler(event) {
        if ($.zipBox.visible() || $(event.target).is('input, textarea')) return true; 
        
        switch (event.keyCode) {
        case 9: /* TAB */
        case 27: /* ESC */
            if ($('#zb-sall-ctl').is('.zb-sall-direct')) closePicbox('esc');
            else closeShowall();
            break;
        default:
            return true;
        }
        
        event.stopPropagation();
        event.preventDefault();
        return false;
    }
    
    
    function navigationKeyHandler(event) {
    
        if ($.zipBox.visible() || $(event.target).is('input,textarea')) return true; 

        switch (event.keyCode) {
        case 9: /* TAB */
            if (search_result && search_result.count > 1) showShowall();
            break;
        case 27: /* ESC */
            closePicbox('esc');
            break;
        case 32: /* Space */
	    if (cur_pic.video) {
		var p = flowplayer();		
		if (p) {
		    p.isPlaying() ? p.pause() : p.play();
		}
	    } else {
		playing ? playPause() : playStart();
	    }
            break;
        case 37: /* ARROW LEFT */
            $("#zb-pd-prev").click();
            break;
        case 39: /* ARROW RIGHT */
            $("#zb-pd-next").click();
            break;
        case 38: /* ARROW UP */
        case 61: /* + */
        case 107:
            playSlower();
        break;
        case 40: /* ARROW DOWN */
        case 109: /* - */
            playFaster();
        break;            
        default:
            return true;
        }
        
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    function guessPictureTag(tagType, idRef) {
        var tagPic = $("#zb-pd-tag-pic-" + tagType), tagTxt = $("#zb-pd-tag-text-by-type-"
                + tagType);
        $.ajax( {
            type : "GET",
            url : "GuessPictureTag.do",
            data : {
                contextType : cur_pic.contextType,
                contextId : cur_pic.contextId,
                taggedPictureId : cur_pic.pictureId,
                tagType : tagType,
                oldIdRef : tagPic.attr("origIdRef") || '',
                idRef : tagPic.attr("idRef") || '',
                tagText : tagTxt.val() || ''
            },
            success : function(data) {
                var oldTxt = tagTxt.val() || '', newTxt = data.tagText || '';
                if (oldTxt.toLowerCase() == newTxt.toLowerCase()) {
                    tagPic.attr("idRef", data.idRef || '').attr(
                            "existingLandmark", data.existingLandmark || '');
                    if (data.imageSrc) {
                        tagPic.find('> img').attr("src", $$.resolve.pic(data.imageSrc));
                    } else {
                        tagPic.hide();
                    }
                    if (oldTxt != newTxt) {
                        tagTxt.val(newTxt);
                    }
                    showTagInfo(tagType);
                }
            },
            dataType : "json"
        });
    }

    function showTagInfo(tagType) {
        var tagPic = $("#zb-pd-tag-pic-" + tagType);
        var tagInfo = $("#zb-no-id-tag-" + tagType);
        var hasId = tagPic.attr("idRef");
        var emptyTag = !$("#zb-pd-tag-text-by-type-" + tagType).val();
        if (tagType == 3) {
            if (tagPic.attr("existingLandmark")) {
                tagInfo.text("Existing landmark.");
            } else {
                tagInfo.text("Landmark will be created.");
            }
            tagInfo.showhide(!emptyTag);
        } else {
            tagInfo.showhide(!hasId && !emptyTag);
        }
        tagPic.showhide(hasId);
    }

    function exitTaggingMode() {
        var speed = 'fast';
        $("#zb-pd-tag-text-by-type-1, #zb-pd-tag-text-by-type-2, #zb-pd-tag-text-by-type-3").blur().flushCache();
        $("#zb-pd-tag-rect").remove();
        $("#zb-pd-picture").removeClass("zb-pd-mapping-mode");
        $(document).unbind("keydown", taggingModeKeyHandler);
        $("#zb-pd-tag-box").fadeOut(speed);
        showExtras(speed);

        cur_pic.tagEditId = null;
        cur_pic.tagEditing = false;
        cur_pic.tagDataReady = false;
        $(document).keydown(navigationKeyHandler);
    }

    function saveTag() {
        if (!cur_pic.tagDataReady)
            return;
        var tagType = getSelectedTagType();
        var tagText = $("#zb-pd-tag-text-by-type-" + tagType).val();

        if (!tagText) {
            alert("You need to provide some text for the tag.");
            return;
        }
        cur_pic.tagDataReady = false;

        var ib = $('#zb-pd-picture'), iw = ib.width(), ih = ib.height();
        var rect = $("#zb-pd-tag-rect");
        var tag = {
            tagType : tagType,
            tagText : tagText,
            pictureId : cur_pic.pictureId,
            xPos : rect.left(),
            yPos : rect.top(),
            width : rect.width(),
            height : rect.height(),
            imageWidth : iw,
            imageHeight : ih,
            idRef : cur_pic.idRef || '',
            authorId : viewerId
        };
        var args;
        if (cur_pic.tagEditId) {
            var oldTag = getTag(cur_pic.tagEditId);
            if (oldTag) {
                tag.tagId = cur_pic.tagEditId;
                args = {
                    url : "UpdatePictureTag.do",
                    success : function(newTag) {
                        getTag(newTag.id, newTag);
                        removeTag(oldTag.id);
                        createTag(newTag);
                        exitTaggingMode();
                        $(document).trigger( {
                            type : "pic-tag.zip",
                            picId : cur_pic.pictureId
                        });
                    }
                };
            }
        } else {
            args = {
                url : "AddPictureTag.do",
                success : function(json) {
                    handleAddTagResult(json);
                    $(document).trigger( {
                        type : "pic-tag.zip",
                        picId : cur_pic.pictureId
                    });
                }
            };
            if (parseInt(tag.tagType) == 3) {
                handleAddTagResult(newTag);
            }
        }

        if (args) {
            $.ajax($.extend(args, {
                data : tag,
                error : function() {
                    cur_pic.tagDataReady = true;
                },
                dataType : 'json'
            }));
        }
    }

    function handleAddTagResult(tag) {
        cur_pic.tags.push(tag);
        createTag(tag);
        exitTaggingMode();
        if (!isEditor()) {
            $$.notify("The tag will have to be approved by a trip editor.");
        }
    }

    function selectTagType(tagType, noFocus) {
        var tt = "" + tagType;
        $("#zb-pd-tag-edit .zb-pd-tag-edit-body").hide();
        $("#zb-pd-tag-box input[name=type]").val([tt]);
        showTagInfo(tt);
        $("#zb-pd-tag-body-" + tt).show();
        if (!noFocus)
            $("#zb-pd-tag-text-by-type-" + tt)[0].focus();
    }

    function showPrivacyBubble() {
        if (!viewerId) {
            alert("You need to login to change the privacy level.");
            return false;
        }
        if (isMissingPicture()) {
            alert("Cannot set privacy for a missing picture.");
            return false;
        }

        if (!isEditor()) {
            return false;
        }
        $.zipBox.show("PicturePrivacyBox.clip", {
            pictureId : cur_pic.pictureId
        }, {
            type: 'popup',
            userData: {
                onSuccess: function(data) {
                    if (cur_pic.pictureId == data.pictureId) {
            		$("#zb-pd-privacy").text(data.privacyName);
                    }
                }
            }
        });
    }

    function prepareMap(cb) {
        var sizeLeft = Math.max(200, Math.min(330, parseInt($.pageSize().width/4)));
        $('#zb-pd-body').splitter({
            outline: true,
            sizeLeft: sizeLeft,
            overlap: true,
            minLeft: 5,
            minRight: 400,
            resizeToWidth: true,
            splitbarClass: 'zb-pd-vsplitbar',
            activeClass: 'zb-pd-vsplitbar-active',
            cursor: 'col-resize'                        
        });
        $(window).unbind('resize', onResize);
        initializeGoogleMaps(function() {
            google_map = initializeMap();
            if (google_map) {
                google_map_width = sizeLeft;
                $('#zb-pd-map-canvas').resize(onMapResize);
                populateMap();        
            } else {
                showMap(false);
                alert("Your browser does not support Google maps");
                $('#zb-pd-geo').remove();
            }
            if (search_result && search_result.editableCnt > 0) draggableSearch();
            if (cb) cb.apply(this, [false, true]);
        });
        onResize();
        google_map_init = google_map_shows = true;
    }

    function notifyGeoBtn() {
        $("#zb-pd-geo").onoffClass('zb-pd-notify', cur_pic.latlng && !google_map_shows);
    }

    function showMap(s, _cb) {
            var b = $('#zb-pd-body'), old_s = google_map_shows, cb = function() {
                if (_cb) _cb.apply(this, [old_s, s]);
            if (s) {
                google_map.checkResize();
                if (cur_pic.latlng) google_map.setCenter(new GLatLng(cur_pic.lat, cur_pic.lng));
                refreshMapHilite();
            }
            };
            if (s && !google_map_init) {
                prepareMap(cb);
            } else {
                if (!s != !google_map_shows) {
                $('#zb-pd-map-canvas').showhide(s);
                b.trigger('resize', s ? Math.max(google_map_width, 200) : 0);
                google_map_shows = s;
            }
                cb.apply(this, []);
            }
            notifyGeoBtn();
    }

    function setMapZoom() {
        if (search_result.area) {
            var a = search_result.area,
                b = new GLatLngBounds(new GLatLng(a.lat1, a.lng1), new GLatLng(a.lat2, a.lng2)),
                c = new GLatLng((a.lat1 + a.lat2)/2, (a.lng1 + a.lng2)/2),
                z = google_map.getBoundsZoomLevel(b);
            google_map.setCenter(c, z);
        }
    }

    function onMapResize() {
        var w = $('#zb-pd-map-canvas').width(), m = $("#zb-pd-notmapped"), f;
        if (w < 100) {
            if (google_map_shows) { 
                f = function() {
                    showMap(false);
                    $('#zb-sall-exit').click(); // exit geotag mode if in it
                };
            }
        } else {
            google_map_width = w;
            f = function() {
                console.log("onMapResize: w=%o", w);
                google_map.checkResize();
            }
        }
        if (google_map_shows) {
            setTimeout(f, 100);
        }
        m.left((w - m.width() - 20)/2).showhide(w > 150);
    }
    
    function loadGoogleApi(cb) {
        if (('google' in window) && ('load' in google)) {
            cb.apply(this, []);
        } else {
            $('#zb-pd-map-canvas').append("<div id='zb-pd-map-loading' class='fontsize3'>Loading map...</div>");
            $.getScript("http://www.google.com/jsapi?key=" + __googleApiKey, cb);
        }
    }
    
    function initializeGoogleMaps(cb) {
            loadGoogleApi(function() {
                google.load("maps", __googleMapsVersion, { callback: cb });
            });
    }
    
    var marker_simple_icon, marker_hilite_icon;
    
    function initializeMap() {
        if (GBrowserIsCompatible()) {
            var map = new GMap2($("#zb-pd-map-canvas")[0], {backgroundColor: '#909090'});
            var point = cur_pic.latlng ? new GLatLng(cur_pic.lat, cur_pic.lng) : new GLatLng(38.0,-87.790203);
            google_map_zoom = cur_pic.latlng ? google_map_zoom_mapped : google_map_zoom_unmapped; 
            map.setCenter(point, google_map_zoom);
            map.setMapType(G_HYBRID_MAP);
            var customUI = map.getDefaultUI();
            customUI.keyboard = false;
            customUI.controls.smallzoomcontrol3d = true;
            customUI.controls.menumaptypecontrol = true;
            customUI.controls.scalecontrol = false;
            map.setUI(customUI);
            
            GEvent.addListener(map, "singlerightclick", onMapRightClick);

            var icon = new GIcon();
            icon.image = $$.rsrc("../images/marker-picture-h-locked.png");
            icon.shadow = $$.rsrc("../images/marker-picture-h-shadow.png");
            icon.size = new GSize(20, 20);
            icon.shadowSize = new GSize(22, 22);
            icon.iconAnchor = new GPoint(10, 10);
            marker_hilite_icon = icon;
            
            var icon = new GIcon();
            icon.image = $$.rsrc("../images/marker-picture3-unlocked.png");
            icon.shadow = $$.rsrc("../images/marker-picture3-shadow.png");
            icon.size = new GSize(20, 20);
            icon.shadowSize = new GSize(22, 22);
            icon.iconAnchor = new GPoint(10, 10);
            marker_simple_icon = icon;

            google.load("search", "1", {
                callback: function() {
                    if ('LocalSearch' in google.maps) {
                        map.addControl(new google.maps.LocalSearch());
                    } else {
                        $.getScript("http://www.google.com/uds/solutions/localsearch/gmlocalsearch.js", function() {
                            map.addControl(new google.maps.LocalSearch());
                        });
                    }
                }
            });
            
            return map;
        }
    }

    function getPictureDropMarker() {
        if (!drop_marker) {
            drop_marker = new GMarker(new GLatLng(0,0), { 
                icon: marker_hilite_icon, 
                clickable: false, 
                zIndexProcess: function() { return 1000; }
            });
            google_map.addOverlay(drop_marker);
        }
        return drop_marker;
    }
    
    function getPicturePreviewMarker() {
        if (!picture_marker) {
            var icon = new GIcon();
            icon.image = $$.rsrc("../images/transp75.gif");
            icon.shadow = $$.rsrc("../images/picture-popup-border-75.png");
            icon.size = new GSize(75, 75);
            icon.shadowSize = new GSize(86, 86);
            icon.iconAnchor = new GPoint(8, 75);

            picture_marker = new GMarker(new GLatLng(0,0), { 
                icon: icon, 
                clickable: false, 
                zIndexProcess: function() { return 1001; }
            });
            google_map.addOverlay(picture_marker);
        }
        return picture_marker;
    }
    
    function selectPicture(p) {
        if (!p || !p.meta) return;
        
        if (showall_shown) {
            if ($("#zb-sall-content").is(".zb-sall-multisel")) {
                $("#zb-sall-content").selectable('select', null, $("#zb-pd-sall-" + p.meta.id));
                return;
            } else {
                closeShowall();
            }
        }
        
        if (p.meta.id != cur_pic.pictureId) {
            loadPicture({
                id: p.meta.id
            }, function() {
                onMarkerMouseOut();
            });
        }
            
    }
    
    function lockPicture(pic, lock) {
        var m = pic.marker; 
        if (lock) {
            if (!pic.unlocked) return;
            if (m) m.disableDragging();
            delete pic.unlocked;
        } else {
            if (pic.unlocked) return;
            if (m) m.enableDragging();
            pic.unlocked = true;
        }
        refreshPictureMarker(pic);
    }
    
    function lockPictureAll(lock) {
        for (var i in search_result.pics) {
            var p = search_result.pics[i];
            if (!p.editor) continue;
            lockPicture(p, lock);
        }
    }
    
    function onMapRightClick(point, src, overlay) {
        var pic = (overlay && overlay.__zip_meta) || null;
        
        var m = $("<ul id='zb-pd-marker-cmenu'></ul>");
        if (pic) {
            if (pic.editor) {
                    //if (pic.unlocked) {
                    //    m.append("<li><a href='#' class='zb-pd-pm-unlock'>Unlock</a></li>");
                    //} else {
                     //    m.append("<li><a href='#' class='zb-pd-pm-lock'>Lock</a></li>");
                    //}
                m.append("<li><a href='#' class='zb-pd-pm-unmap'>Unmap</a></li>");
                if (total_cnt() > 0) {
                    var mapped = 0;
                    for (var i in search_result.pics) {
                        var p = search_result.pics[i];
                        if (p.editor && p.lat != null) mapped++;
                    }
                    if (mapped > 1) {
                        m.append("<li><a href='#' class='zb-pd-pm-unmap-all'>Unmap all</a></li>");
                    }
                }
            }
        }
        if (false && total_cnt() > 0) {
                var locked = 0, unlocked = 0;
            for (var i in search_result.pics) {
                var p = search_result.pics[i];
                if (!p.editor) continue;
                if (p.unlocked) unlocked++;
                else locked++;
            }
            var cnt = pic ? 0 : 1;
            if (Math.max(locked, unlocked) > cnt) {
                if (pic) {
                        m.append("<li class='zb-pd-sep'></li>");
                }
                if (locked > cnt) {
                    m.append("<li><a href='#' class='zb-pd-pm-unlock-all'>Unlock all</a></li>");
                }
                if (unlocked > cnt) {
                    m.append("<li><a href='#' class='zb-pd-pm-lock-all'>Lock all</a></li>");
                }
            }
        }
        if (m.children().length == 0) return;
        
        m.contextmenu(point, src).appendTo("#zb-pd-map-canvas");
        $('#zb-pd-marker-cmenu').click(function(e) {
            var t = $(e.target);
            if (t.is('.zb-pd-pm-unlock')) {
                lockPicture(pic, false);
            } else if (t.is('.zb-pd-pm-lock')) {
                lockPicture(pic, true);
            } else if (t.is('.zb-pd-pm-unmap')) {
                unmapPicture(pic);
            } else if (t.is('.zb-pd-pm-unmap-all')) {
                if (confirm("Unmap ALL photos and videos from the map? This operation can not be undone.")) {
                    for (var i in search_result.pics) {
                        unmapPicture(search_result.pics[i]);
                    }
                }
            }
            return false; 
        });
    }
    
    function onMarkerClick(pt) {
        selectPicture(this.__zip_meta);
    }
    
    function onMarkerMouseOver() {
        var p = this.__zip_meta, m = getPicturePreviewMarker(), sz = marker_simple_icon.size;
        
        if (!p) return;

        var pos = google_map.fromLatLngToContainerPixel(p._newpos || new GLatLng(p.lat, p.lng));         
        m.setLatLng(google_map.fromContainerPixelToLatLng(new GPoint(pos.x + sz.width, pos.y - sz.height)));
        
        m.setImage($$.pictures.urlBySize(p, 'i'));

        m.show();
    }
    
    function onMarkerMouseOut() {
        var m = getPicturePreviewMarker();
        m.hide();
        m.setImage($$.rsrc("../images/transp75.gif"));
    }
    
    function onMarkerDragEnd(pt) {
        mapPicture(this.__zip_meta, pt);
    }

    function createSimpleMarker(p) {
        var m = new GMarker(new GLatLng(p.lat, p.lng), { 
            icon: marker_simple_icon,
            draggable: p.editor
        });
        m.__zip_meta = p;
        p.marker = m;

        //if(p.editor) m.disableDragging();
        GEvent.addListener(m, "click", onMarkerClick);
        GEvent.addListener(m, "mouseover", onMarkerMouseOver);
        GEvent.addListener(m, "mouseout", onMarkerMouseOut);
        GEvent.addListener(m, "dragend", onMarkerDragEnd);
        
        google_map.addOverlay(m);
        
        return m;
    }
    
    function setMarkerLook(m, st) {
        if (!m || !st) return;
        if (st == 'hilite') {
            m.setImage($$.rsrc("../images/marker-picture-h-locked.png"));
        } else if (st == 'locked') {
            m.setImage($$.rsrc("../images/marker-picture3-locked.png"));
        } else if (st == 'unlocked') {
            m.setImage($$.rsrc("../images/marker-picture3-unlocked.png"));
        }
    }

    function refreshPictureMarker(pic) {
        setMarkerLook(pic.marker, pic.unlocked ? 'unlocked' : 'locked');
    }
    
    function hilitePicture(pic) {
        if (picture_hilite) {
            refreshPictureMarker(picture_hilite);
            picture_hilite = null;            
        }
        if (pic) {
            setMarkerLook(pic.marker, 'hilite');
            picture_hilite = pic;
        }
    }
    
    function populateMap() {
        if (!google_map) return;
        google_map.clearOverlays();
        
        if (total_cnt() > 0) {
            for (var i in search_result.pics) {
                var p = search_result.pics[i];

                if (p.lat != null) {
                    createSimpleMarker(p);
                }
            }
        }

        refreshMapHilite();
    }
    
    function refreshMapHilite() {
        if (!google_map) return;

        var lbl = $('#zb-pd-notmapped'),
            pic = (!showall_shown && search_result && search_result.pics && search_result.pics[cur_index]);

        hilitePicture(pic);

        if (pic && pic.lat != null) {
            if (lbl.length) {
                lbl.remove();
                if (google_map_zoom < google_map_zoom_unmapped) {
                    google_map_zoom = google_map_zoom_mapped;
                }
                google_map.setZoom(google_map_zoom);                
            }
            
            var point = new GLatLng(pic.lat, pic.lng);
            if(!google_map.getBounds().contains(point)) {
                google_map.setCenter(point);
            }
        } else if (showall_shown) {
            lbl.remove();
        } else {
            if (!lbl.length) {
                google_map_zoom = google_map.getZoom();
                google_map.setZoom(google_map_zoom_unmapped);
                var m = $("<div id='zb-pd-notmapped' class='shade50 fontsize3'>Picture not mapped</div>").showhide(!showall_shown);
                $('#zb-pd-map-canvas').append(m);
                onMapResize();
            }
        }
    }

    function dropOverMapStart() {
        $("#zb-pd-map-canvas").unbind("dropstart drop dropend").bind("dropstart", function(e) {
            getPictureDropMarker().show();
        }).bind("drop", function(e) {
            var pt = getPictureDropMarker().getLatLng();
                mapPictures(e.dragProxy.sel, pt);
                $('#zb-pd-body').trigger('ondrop', [e, 'map', pt, e.dragProxy.sel])
        }).bind("dropend", function(e){
            getPictureDropMarker().hide();
        });
    }
    
    function dragOverMapStart(e, sel) {
        if (!sel || !sel.length) return false;
        var t = $(e.target).closest('a');
        if (!t.length) return false;
                
        var proxy = $("<div/>").css({position: 'absolute', opacity: 0.8, 'z-index': 10000}), cnt = 4, step=3;
        for (var i = Math.min(sel.length, cnt - 1); i >= 0 ; i--) {
            var pic = search_result.pics[parseInt( $(sel[i]).attr('picIndex'))];
            if (!pic) continue;
            proxy.append("<img src='" + (i < 2 ? pic.url : $$.rsrc('../images/trasp.gif'))+ "' " + 
                         "style='position: absolute; width: 50px; height: 50px; " + 
                         "top: " + (i*step) + "px; left:" + (i*step) + "px;" +
                         (i > 1 ? "border: 1px solid #000; border-left: none; border-top: none;" : "") + 
                         "'>");
        }
        proxy.css({width: 50 + cnt*step, height: 50 + cnt*step});
        if (sel.length > 1) proxy.append($("<div style='position: absolute; bottom: -15px; right: 2px;font-size: 10px; color: #fff; padding: 1px 3px' class='shade50'></div>").html("" + (sel.length) + "&nbsp;photos"));        
        proxy[0].sel = sel;
        mapping_picture = true;
        proxy.appendTo('#zb-pd-body');
        
        dropOverMapStart();

        return proxy;
    }
    
    function dragOverMapDragging(e) {
        $(e.dragProxy).css({
            top: e.clientY,
            left: e.clientX
        });
        var m = getPictureDropMarker();
        if (!m.isHidden()) {
            m.setLatLng(google_map.fromContainerPixelToLatLng(new GPoint(e.clientX, e.clientY)));
        }
    }

    function dragOverMapEnd(e) {
        $(e.dragProxy).remove();
        mapping_picture = false;
    }
    
    function mapPictures(sel, pt) {
        if (!sel || !sel.length || !google_map) return;
        var offx = 0, offy = 0, fuzzines = 30, 
            cp = google_map.fromLatLngToContainerPixel(pt);
        sel.each(function() {
            mapPicture(search_result.pics[parseInt($(this).attr('picIndex'))],
                       google_map.fromContainerPixelToLatLng(new GPoint(cp.x + offx, cp.y + offy)),
                       true);
            offx = parseInt((0.5 - Math.random()) * fuzzines);
            offy = parseInt((0.5 - Math.random()) * fuzzines);
        });
        refreshMapHilite();
    }
    
    function unmapPicture(pic) {
        if (!pic || !pic.editor || pic.lat == null) return;
        var m = pic.marker;
        
        if (m) m.hide();
        $.ajax( {
            type : "POST",
            url : 'UnmapPicture.do',
            data : {
                pictureId : pic.meta.id
            },
            success : function(json) {
                delete pic.marker;
                delete pic.lat;
                delete pic.lng;
                if (m) {
                    GEvent.clearInstanceListeners(m);
                    google_map.removeOverlay(m);
                }
                if (pic.meta.id == cur_pic.pictureId) {
                    cur_pic.lat = null;
                    cur_pic.lng = null;
                    cur_pic.latlng = null;
                    $('#zb-pd-geolink').replaceWith("<a href='#' id='zb-pd-geomap'>click to map it</a>");
                }
            },
            error : function() {
                if (m) m.show();
            },
            dataType : "json"
        });
    }
    
    function mapPicture(pic, pt, batch) {
        if (!pic || !pic.editor || !google_map) return;        
        if (!pt) pt = google_map.getCenter();
        
        var temp_marker, old_pt;
        
        pic._newpos = pt;
        if (pic.marker) {
            old_pt = pic.marker.getLatLng(); 
            pic.marker.setLatLng(pt);
        } else {
            temp_marker = new GMarker(pt, { 
                icon: marker_hilite_icon, 
                clickable: false, 
                zIndexProcess: function() { return 1000; }
            });
            google_map.addOverlay(temp_marker);
        }

        var dist = null;
        if (pic.lat != null) {
            dist = pt.distanceFrom(new GLatLng(pic.lat, pic.lng));
        }
        if (pic.meta.id == cur_pic.pictureId) {
            $('#zb-pd-notmapped').remove();
        }
        $.ajax( {
            type : "POST",
            url : 'MapPicture.do',
            data : {
                pictureId : pic.meta.id,
                lat: pt.lat(),
                lng: pt.lng(),
                zoom: google_map.getZoom(),
                dist: dist
            },
            success : function(json) {
                pic.lat = json.lat;
                pic.lng = json.lng;
                if (pic.marker) pic.marker.setLatLng(new GLatLng(pic.lat, pic.lng)); 
                else createSimpleMarker(pic);
                if (pic.meta.id == cur_pic.pictureId) {
                    cur_pic.lat = json.lat;
                    cur_pic.lng = json.lng;
                    cur_pic.latlng = json.latlng;
                    $('#zb-pd-geomap').replaceWith("<a href='#' id='zb-pd-geolink'>mapping...</a>");            
                    $('#zb-pd-geolink').html(cur_pic.latlng);                    
                }
            },
            error : function() {
                if (old_pt && pic.marker) pic.marker.setLatLng(old_pt);
            },
            complete : function() {
                delete pic._newpos;
                if (temp_marker) google_map.removeOverlay(temp_marker);
                if (!batch) refreshMapHilite();
            },
            dataType : "json"
        });
    }
    
    function thinking() {
        $.zipBox.thinking();
        body_sel.css('cursor', '');
    }

    function ready() {
        $.zipBox.ready();
        body_sel.css('cursor', 'default');
    }
    
    function page_width() {
        return $('#zb-pd-page').width();
    }
    
    function page_height() {
        return $('#zb-pd-page').height();
    }

    function page_size() {
        var p = $('#zb-pd-page');        
        return {width: p.width(), height: p.height()};
    }

    function notify(msg) {
        $$.notify(msg);
    }

    function total_cnt() {
        return (search_result && search_result.count) || 0;
    }

    function inactivityHandler() {
        var dt = new Date().getTime() - lastActivityTS;
        if (dt - INACTIVITY_TIMEOUT < -100) {
            inactivityTid = setTimeout(inactivityHandler, dt);
        } else {
            inactivityTid = null;
            if (!(extras_hidden || showall_shown || mapping_picture || isCaptionEdited() || $.zipBox.visible())) hideExtras(400, true);
        }
    }

    function activityHandler(e) {
        lastActivityTS = e ? e.timeStamp : new Date().getTime();
        if (extras_hidden && !cur_pic.tagEditing) showExtras(400, true);
        if (!inactivityTid) inactivityTid = setTimeout(inactivityHandler, INACTIVITY_TIMEOUT);
    }
    
    function getRelativePosition(e) {
        var xpos = e.layerX ? e.layerX : e.offsetX ? e.offsetX : 0;
        var ypos = e.layerY ? e.layerY : e.offsetY ? e.offsetY : 0;
        return {
            x : xpos,
            y : ypos
        };
    }

    function onResize() {
        var img = $("#zb-pd-img");
        var bw = img.width(), bh = img.height();

        if (bw && bh) {
            var ps = page_size();
            $('#zb-pd-main-box').css({
                left : (ps.width - bw) / 2,
                top : (ps.height - bh) / 2,
                width : bw,
                height : bh
            });
        }

        if (cmnts_shown)
            adjustComments(true, false);
        else
            cmnts_need_adjust = true;
        repositionShowall();
        positionToolbox();
        repositionSearch();
        repositionInfo();
	populateImageObjects(showall_size);
    }

    function closePicbox(why) {
        window.history.back();
    }

    function isCaptionEdited() {
        return $("#zb-pd-caption-edit textarea").length != 0;
    }
    
    function loggedIn() {
        return viewerId != null;
    }

    function doLogin() {
        var url = "Picture.page?auth=true&id=" + cur_pic.pictureId;
        if (search_result && search_result.searchCnxt) {
            url = url + "&queryString=" + escape(search_result.searchCnxt);
        }
        window.location = url;
    }
    
    function viewerOwnesPicture() {
        //we don't own missing pictures
        return (viewerId == cur_pic.ownerId && cur_pic.pictureId > 0);
    }
    
    function viewerUploadedPicture() {
        return (viewerId == cur_pic.uploaderId && cur_pic.pictureId > 0);
    }

    function isMissingPicture() {
        //test if we have a real pic, or just display the missing pic
        return (cur_pic.pictureId == 0);
    }

    function viewerCanDeletePictureTag(tag) {
        if (tag == null)
            return false;
        return (isEditor() || (viewerId == tag.authorId && !tag.approved));
    }

    function isEditor() {
        if (showall_shown || !cur_pic || !('editor' in cur_pic)) {
            return search_result && search_result.editor;
        } else {
            return (cur_pic.editor);
        }
    }
    
})(jQuery);
