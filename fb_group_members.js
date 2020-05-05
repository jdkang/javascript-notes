// INSTRUCTIONS:
//  1. Read the code
//  2. Navigate to a FB Group's Member List
//  3. Paste code into Developer Console (F12)
//  4. run scrape() function
//  5. Copy outputed JSON and save as file
//  5b. If the JSON is scrolled out of view, simply re-run: process_profiles(profiles);
//  6. Check if your browser has blocked new tabs from opening, allow them
//  7. Repeat steps on new page(s)
//  8. See "NOTES" below before writing scripts to process JSON data
//
// Based on: https://gist.github.com/yurukov/8326b3803b436c100cac#file-commands-js
//
// NOTES:
//  - Since you're potentially scraping multiple pages of the same group seperately, you'l need to ACCOUNT FOR DUPLICATES
//  - Accuracy may diminish >=10k users
//  - This will pickup "invited" users
//
// TODO:
//  - Rewrite in nightmarejs or puppeteer

function process_profiles(profiles, return_obj=false, noisey=false) {
    var memberMap = {} // could probably replace w/ new Map()
    var memberIds = [] // Preserve insert order
    var invitedRegex = /^invited\s+by/i
    var getRoleRank = role => {
        // With duplicate entries, figure out which 'role' to keep
        rank = -1
        if((typeof role) == 'string') {
            role = role.toLowerCase();
        }
        switch(role) {
           case 'admin':     rank = 1; break;
           case 'moderator': rank = 2; break;
           case 'invited':   rank = 3; break;
           case 'member':    rank = 4; break;
           default:          rank = 200
        }
        return rank
    }
    
    // Process
    profiles.forEach(e => {
        // flavor text
        var mightBeInvited = false
        let flavorDiv = e.parentNode.getElementsByClassName("_60rj")
        let flavorTxt = []
        for(i=0; i < flavorDiv.length; i++) {
            if(flavorDiv[i].innerText && (flavorDiv[i].innerText.toLowerCase().trim() != "preview")) {
                flavorTxt.push(flavorDiv[i].innerText)
            }
        }
        mightBeInvited = (flavorTxt.length >= 2) && (flavorTxt[0] =='Previewing') && invitedRegex.test(flavorTxt[1])
        
        // role
        let role = 'unknown'
        let statusSpan = e.parentElement.parentElement.getElementsByClassName("igjjae4c glosn74e f2jdl7fy cxfqmxzd")
        if(statusSpan.length == 1) {
            role = statusSpan[0].innerText
        } else if(mightBeInvited) {
            role = 'invited'
        } else {
            role = 'member'
        }
                
        // basic info
        let profile_id = parseInt(e.dataset.hovercard.replace(/.+id=([0-9]+)&.+/, '$1'));
        let name = e.text;
        let photo = `https://graph.facebook.com/${profile_id}/picture?width=9999`;
        let profile = 'https://facebook.com/${profile_id}'
        
        // add or merge parsed profile
        if(!memberIds.includes(profile_id)) {
            memberIds.push(profile_id)
        }
        var existingMember = memberMap[profile_id]
        if(existingMember == null) {
            if(noisey) {
                console.log('+ ' + profile_id + ' ' + name);
            }
            memberMap[profile_id] = {
                profile_id,
                name,
                role,
                photo,
                profile,
                flavorTxt
            }
        } else {
            // add/update properties
            if(!existingMember['name'] && name) {
                if(noisey) {
                    console.log('-- ' + profile_id + ' updating name to:' + name);
                }
                existingMember['name'] = name;
            }
                        
            if(role) {
                if(noisey) {
                    console.log('-- ' + profile_id + ' comparing roles: ' + role + '(' + getRoleRank(role) + ')' + ' v. ' + existingMember['role'] + '(' + getRoleRank(existingMember['role']) + ')')
                }
                if(getRoleRank(role) < getRoleRank(existingMember['role'])) {
                    if(noisey) {
                        console.log('-- ' + profile_id + ' updating role to:' + role);
                    }
                    existingMember['role'] = role;
                }
            }
            
            for(i=0; i < flavorTxt.length; i++) {
                if(!existingMember['flavorTxt'].includes(flavorTxt[i])) {
                    if(noisey) {
                        console.log('-- ' + profile_id + ' adding flavor text:' + flavorTxt[i])
                    }
                    existingMember['flavorTxt'].push(flavorTxt[i])
                }
            }
        }
    });
    
    // Clean and Export Data
    var memberList = []
    memberIds.forEach(id => {
        // flatten flavorTxt into description
        memberMap[id]['description'] = memberMap[id]['flavorTxt'].join(' | ')
        delete memberMap[id]['flavorTxt']
        
        // add to memberList
        memberList.push(memberMap[id])
    });
    var data = {
        "name": "Group Members",
        "src": {
            "href": window.location.href,
            "title": document.title
        },
        "memberCount": memberList.length,
        "members": memberList
    }
    if(return_obj) {
        return data
    }
    return JSON.stringify(data);
}
function loadMore {
    let loadMoreAsync = groupsMemberBrowser.querySelectorAll('a.uiMorePagerPrimary');
    let loadMore = groupsMemberBrowser.querySelectorAll('a.uiMorePagerPrimary');
    for(i=0; i < loadMore.length; i++) {
        if(loadMore[i].rel && loadMore[i].rel.toLowerCase() == 'async') {
            console.log('Expanding: ' + loadMore[i].href);
            loadMore[i].click();
        } else {
            console.log('Opening New Tab: ' + loadMore[i].href);
            window.open(loadMore[i].href, '_blank');
        }
    }
}
function scrape() {
    loadMore();
    const scroller = setInterval(function() {
      console.log('SCRAPING ' + window.location.href);
      a = $$("img"); for (i=0;i<a.length;i++) a[i].parentNode.removeChild(a[i]); // strip images to reduce memory size
      window.scrollTo(0,document.body.scrollHeight);
      let groupsMemberBrowser = document.querySelector('#groupsMemberBrowser'); 
      let loadMore = groupsMemberBrowser.querySelectorAll('a.uiMorePagerPrimary');
      if(loadMore.Length == 0) {
        clearInterval(scroller);
        console.clear();
        console.log('no more data');
        // process
        var profiles = groupsMemberBrowser.querySelectorAll('a[data-hovercard*="/ajax/"]');
        process_profiles(profiles);
      }
    },3000);
}
