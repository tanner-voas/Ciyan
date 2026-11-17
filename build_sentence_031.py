"""Compose context-rich Chinese examples from curated pattern families.

Data-only release: outputs ordinary Cíyán grammar JSON with exact {vocabulary} tokens.
The builder fails closed for missing vocabulary, Chinese text outside braces, or
uncovered cards. The semantic categories below are editorially controlled.
"""
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
import re, csv

ROOT=Path(__file__).resolve().parent
TOKENS=re.compile(r'\{([^{}]+)\}')
PUNCT={'，':',','、':',','。':'.','！':'!','？':'?','：':':','；':';','（':' (','）':')','“':'"','”':'"'}

class Writer:
    def __init__(self,master):
        self.master=master
        self.by_markup={}
        self.association=defaultdict(set)
        self.principles=defaultdict(set)
        self.missing=set()
    def add(self,markup,english,principle,group='grammar-principles',distractors=()):
        toks=TOKENS.findall(markup)
        if not toks:raise ValueError('No movable tokens: '+markup)
        missing=[t for t in toks if t not in self.master]
        if missing:
            self.missing.update(missing)
            return None
        if len(toks)>35:raise ValueError('Too many tokens: '+markup)
        fixed=TOKENS.sub('',markup)
        illegal=[c for c in fixed if '\u3400'<=c<='\u9fff']
        if illegal:raise ValueError('Unbraced characters '+repr(illegal)+' in '+markup)
        if not english or len(english)>900:raise ValueError('English missing/too long: '+markup)
        if markup not in self.by_markup:
            pinyin=[]
            for x in re.findall(r'\{[^{}]+\}|[^{}]+',markup):
                if x.startswith('{'):
                    pinyin.append(self.master[x[1:-1]]['pinyin'].strip())
                else:
                    pinyin.append(''.join(PUNCT.get(c,c) for c in x))
            text=' '.join(pinyin)
            text=re.sub(r'\s+([,.?!;:)])',r'\1',text)
            text=re.sub(r'([(:])\s+',r'\1',text)
            text=re.sub(r'([,.?!;])(?=[^\s])',r'\1 ',text)
            text=text.strip()
            if text:text=text[0].upper()+text[1:]
            entry={'id':'ctx-'+sha256(markup.encode()).hexdigest()[:20], 'markup':markup,'pinyin':text,
                   'english':english,'distractors':list(distractors),'source':'Context: '+principle[:69],
                   'createdAt':'2026-11-17T00:00:00.000Z'}
            self.by_markup[markup]=entry
        entry=self.by_markup[markup]
        if group:self.association[group].add(entry['id'])
        self.principles[principle].add(entry['id'])
        return entry
    def tokens(self,entry):return TOKENS.findall(entry['markup'])
    def coverage(self):return set(t for g in self.by_markup.values() for t in self.tokens(g))


def english_label(card):
    return re.split(r'\s+—\s+|[,;]|\s*\(',card['english'],1)[0].strip()
def lower_label(card):
    label=re.sub(r'^to\s+', '',english_label(card),flags=re.I)
    if not label:return card['hanzi']
    return label[:1].lower()+label[1:] if label[:1].isupper() and label[1:2].islower() else label

def grouped(items,size):
    for i in range(0,len(items),size):yield items[i:i+size]

def add_many_places(w,deck):
    words=[c['hanzi'] for c in deck['cards']]
    if deck['id']=='eu-capitals':
        for c,d in zip(deck['cards'][::2],deck['cards'][1::2]):
            country,capital=c['hanzi'],d['hanzi']
            w.add('{'+country+'}{的}{首都}{是}{'+capital+'}。',f'The capital of {english_label(c)} is {english_label(d)}.','country-capital facts',deck['id'])
        return
    if deck['id']=='asia-world-capitals':
        pairs=[('越南','河内'),('菲律宾','马尼拉'),('印度尼西亚','雅加达'),('马来西亚','吉隆坡'),('韩国','首尔'),('朝鲜','平壤'),('老挝','万象'),('柬埔寨','金边'),('泰国','曼谷'),('澳大利亚','堪培拉'),('新西兰','惠灵顿'),('俄罗斯','莫斯科'),('英格兰','伦敦'),('苏格兰','爱丁堡'),('威尔士','加的夫'),('北爱尔兰','贝尔法斯特')]
        for c,cap in pairs:
            w.add('{'+c+'}{的}{首都}{是}{'+cap+'}。',f'The capital of {english_label(w.master[c])} is {english_label(w.master[cap])}.','capital and constituent nation',deck['id'])
        w.add('{新加坡}{的}{首都}{也}{叫}{新加坡}。','The capital of Singapore is also named Singapore.','city-state and capital',deck['id'])
        w.add('{南非}{有}{三}{个}{首都}：{比勒陀利亚}、{开普敦}{和}{布隆方丹}。',
              'South Africa has three capitals: Pretoria, Cape Town, and Bloemfontein.','multiple capitals',deck['id'])
        w.add('{印度尼西亚}{的}{首都}{现在}{是}{雅加达}，{努山塔拉}{是}{计划}{中}{的}{新}{首都}。',
              'Jakarta is currently the capital of Indonesia; Nusantara is the planned new capital.','present versus future administrative status',deck['id'])
        w.add('{马来西亚}{的}{首都}{是}{吉隆坡}，{布城}{是}{行政}{中心}。',
              'Kuala Lumpur is Malaysia’s capital, while Putrajaya is its administrative center.','administrative distinction',deck['id'])
        return
    if deck['id']=='visited-places':
        # Real travel history from the user; never infer additional visits.
        for i,grp in enumerate(grouped(words,3)):
            terms=['{'+x+'}' for x in grp]
            inner=('、'.join(terms[:-1])+'{和}'+terms[-1]) if len(terms)>1 else terms[0]
            names=[english_label(w.master[x]) for x in grp]
            namelist=', '.join(names[:-1])+' and '+names[-1] if len(names)>1 else names[0]
            w.add('{我}{以前}{去}{过}'+inner+'。',f'I have visited {namelist}.','past travel experience: 过',deck['id'])
        return
    # Province-level terms such as 省 and 市 name administrative types, not destinations.
    category_words={'省','市','自治区','特别行政区','国家','首都','城市','亚洲','欧洲','非洲','大洋洲','北美洲','南美洲','南极洲'}
    for x in list(words):
        if x not in category_words:continue
        w.add('{我们}{今天}{学习}{'+x+'}{的}{地理}{知识}。',f'Today we are studying geography terminology: {english_label(w.master[x])}.','administrative and geographic terms',deck['id'])
    words=[x for x in words if x not in category_words]
    for i,grp in enumerate(grouped(words,3)):
        terms=['{'+x+'}' for x in grp]
        inner=('、'.join(terms[:-1])+'{和}'+terms[-1]) if len(terms)>1 else terms[0]
        names=[english_label(w.master[x]) for x in grp]
        label=', '.join(names[:-1])+' and '+names[-1] if len(names)>1 else names[0]
        if i%3==0:
            w.add('{我}{想}{去}'+inner+'{旅行}。',f'I would like to travel to {label}.','serial verb construction with destinations',deck['id'])
        elif i%3==1:
            w.add('{你}{去}{过}'+inner+'{吗}？',f'Have you been to {label}?','experience marker 过 and questions',deck['id'])
        else:
            w.add('{我们}{可以}{计划}{去}'+inner+'{旅游}。',f'We could plan a trip to {label}.','modal verb and future plans',deck['id'])


def add_food(w,deck,kind):
    cards=deck['cards']
    beverages={'咖啡','美式咖啡','拿铁','浓缩咖啡','红茶','绿茶','乌龙茶','奶茶','珍珠奶茶','果汁','矿泉水','气泡水','可乐','啤酒','葡萄酒','白酒','牛奶','全脂牛奶','脱脂牛奶','燕麦奶','豆浆'}
    nutrition={'蛋白质','碳水化合物','脂肪','热量','蛋白粉'}
    meals=[c for c in cards if c['hanzi'] not in nutrition and c['hanzi'] not in beverages]
    drinks=[c for c in cards if c['hanzi'] in beverages]
    if kind=='ingredients':
        for i,grp in enumerate(grouped(cards,2)):
            ts=['{'+c['hanzi']+'}' for c in grp];s='{和}'.join(ts)
            e=' and '.join(lower_label(c) for c in grp)
            if i%3==0:w.add('{我}{今天}{在}{超市}{买}{了}'+s+'。',f'I bought {e} at the supermarket today.','completed action with food objects',deck['id'])
            elif i%3==1:w.add('{我们}{准备}{用}'+s+'{做饭}。',f'We are planning to cook with {e}.','preposition 用 and coordinated objects',deck['id'])
            else:w.add('{你}{喜欢}'+s+'{吗}？',f'Do you like {e}?','yes/no question with food',deck['id'])
    else:
        for i,grp in enumerate(grouped(meals,2)):
            ts=['{'+c['hanzi']+'}' for c in grp]; names=[lower_label(c) for c in grp]
            if len(grp)==1:w.add('{我}{想}{尝尝}'+ts[0]+'。',f'I want to try {names[0]}.','verb reduplication: trying a dish',deck['id'])
            elif i%4==0:w.add('{我}{想}{吃}'+ts[0]+'，{你}{想}{吃}'+ts[1]+'{吗}？',f'I want to eat {names[0]}. Do you want {names[1]}?','contrast and question in a restaurant',deck['id'])
            elif i%4==1:w.add('{我们}{今天}{点}{了}'+ts[0]+'{和}'+ts[1]+'。',f'We ordered {names[0]} and {names[1]} today.','ordering and completed action',deck['id'])
            elif i%4==2:w.add('{我}{喜欢}'+ts[0]+'，{但是}{他}{更}{喜欢}'+ts[1]+'。',f'I like {names[0]}, but he prefers {names[1]}.','comparison with 更',deck['id'])
            else:w.add('{你}{喜欢}'+ts[0]+'{还是}'+ts[1]+'？',f'Do you prefer {names[0]} or {names[1]}?','choice question with 还是',deck['id'])
        for i,grp in enumerate(grouped(drinks,2)):
            ts=['{'+c['hanzi']+'}' for c in grp];e=' and '.join(lower_label(c) for c in grp)
            if i%2:w.add('{这}{家}{店}{有}'+('{和}'.join(ts))+'。',f'This shop has {e}.','existential 有 with drinks',deck['id'])
            else:w.add('{我}{想}{喝}'+('{和}'.join(ts))+'。',f'I would like to drink {e}.','food and drink selection',deck['id'])
        for c in cards:
            if c['hanzi'] in nutrition:
                w.add('{我}{想}{了解}{'+c['hanzi']+'}{的}{作用}。',f'I want to learn more about the role of {lower_label(c)}.','nominalization with 的',deck['id'])


def add_ordering(w,deck):
    byword={c['hanzi']:c for c in deck['cards']}
    service={'菜单','餐具','筷子','勺子','叉子','刀','碗','盘子','杯子','吸管','纸巾','沙拉酱'}
    goods={'酱油','醋','盐','糖','油','辣椒油','蚝油','番茄酱'}
    flavors={'辣','麻','甜','咸','酸','苦','清淡','油腻','新鲜','生','熟','脆','软','嫩','烫'}
    custom={'微辣','中辣','特辣','少辣','免辣','少冰','去冰','常温','无糖','半糖'}
    actions={'蒸','煮','炒','煎','炸','烤','炖','拌','切','加热','冷藏','冷冻'}
    service=list(x for x in byword if x in service)
    for i,grp in enumerate(grouped(service,2)):
        terms='{和}'.join('{'+x+'}' for x in grp)
        names=' and '.join(lower_label(byword[x]) for x in grp)
        w.add('{请}{给}{我}'+terms+'。',f'Please give me {names}.','polite request',deck['id'])
    for i,grp in enumerate(grouped([x for x in byword if x in goods],2)):
        terms='{和}'.join('{'+x+'}' for x in grp)
        names=' and '.join(lower_label(byword[x]) for x in grp)
        w.add('{这}{家}{店}{有}'+terms+'{吗}？',f'Does this shop have {names}?','existential yes/no question',deck['id'])
    flavor_minor={'辣','麻','甜','咸','酸','苦','油腻','烫'}
    flavor_positive={'清淡','新鲜','脆','软','嫩'}
    for x in byword:
        if x in flavor_minor:
            w.add('{这}{道}{菜}{有点}{'+x+'}。',f'This dish is a little {lower_label(byword[x])}.','degree complement describing flavors',deck['id'])
        elif x in flavor_positive:
            w.add('{这}{道}{菜}{很}{'+x+'}。',f'This dish is {lower_label(byword[x])}.','stative predicate describing food',deck['id'])
        elif x in {'生','熟'}:
            w.add('{这}{个}{鸡蛋}{是}{'+x+'}{的}。',f'This egg is {lower_label(byword[x])}.','state of cooking with 是...的',deck['id'])
    for i,grp in enumerate(grouped([x for x in byword if x in custom],2)):
        terms='{和}'.join('{'+x+'}' for x in grp)
        names=' and '.join(lower_label(byword[x]) for x in grp)
        w.add('{点菜}{的}{时候}，{你}{想}{选}{'+grp[0]+'}'+('{还是}{'+grp[1]+'}' if len(grp)>1 else '')+'？',f'When ordering, would you choose {names.replace(" and "," or ")}?','alternative menu preferences',deck['id'])
    for i,grp in enumerate(grouped([x for x in byword if x in actions],2)):
        terms='{和}'.join('{'+x+'}' for x in grp)
        names=' or '.join(lower_label(byword[x]) for x in grp)
        for x in grp:
            w.add('{请}{把}{菜}{'+x+'}{一下}。',f'Please {lower_label(byword[x])} the vegetables briefly.','disposal 把 + action + complement',deck['id'])
    handled=set(service)|goods|flavors|custom|actions
    for c in deck['cards']:
        if c['hanzi'] in handled:continue
        x=c['hanzi']
        special={
         '点菜':('{我们}{现在}{可以}{点菜}{了}。','We can order now.'),
         '买单':('{我们}{吃}{完}{了}，{可以}{买单}{吗}？','We have finished eating; can we pay the bill?'),
         '结账':('{我}{想}{结账}。','I would like to pay the bill.'),
         '打包':('{这些}{菜}{可以}{打包}{吗}？','Can these dishes be packed to take away?'),
         '外卖':('{今天}{太}{忙}，{我}{想}{点}{外卖}。','I am too busy today, so I want to order delivery.'),
         '堂食':('{我}{不}{打包}，{我}{要}{堂食}。','I do not want takeaway; I will eat here.'),
         '份':('{我}{想}{点}{两}{份}{炒饭}。','I want to order two portions of fried rice.'),
         '瓶':('{请}{给}{我}{一}{瓶}{水}。','Please give me a bottle of water.'),
         '过敏':('{我}{对}{花生}{过敏}。','I am allergic to peanuts.'),
         '素食':('{他}{喜欢}{吃}{素食}。','He likes to eat vegetarian food.'),
         '纯素':('{她}{吃}{纯素}{食品}。','She eats vegan food.'),
         '忌口':('{医生}{让}{我}{忌口}。','The doctor told me to avoid certain foods.'),
         '保质期':('{这个}{牛奶}{的}{保质期}{很}{短}。','This milk has a short shelf life.'),
         '配料':('{这}{个}{食品}{的}{配料}{很}{简单}。','The ingredients in this food are simple.'),
        }
        if x in special:w.add(*special[x],'food-service practical use',deck['id'])
        else:w.add('{我}{想}{了解}{'+x+'}{的}{意思}。',f'I want to understand what {lower_label(c)} means.','restaurant terminology',deck['id'])


def add_activity(w,deck):
    exercise={'运动','锻炼','健身','训练','热身','拉伸','放松','恢复','休息','跑步','慢跑','散步','徒步','爬山','登山','骑车','骑行','游泳','潜水','冲浪','滑雪','滑冰','滑板','篮球','足球','羽毛球','乒乓球','网球','排球','棒球','高尔夫','拳击','武术','瑜伽','普拉提','跳舞','跳绳','举重','俯卧撑','引体向上','深蹲','硬拉','卧推','平板支撑','露营','野餐','摄影','拍照','旅行','看电影','看书','玩游戏','做饭','逛街','唱歌'}
    names={c['hanzi']:c for c in deck['cards']}
    sports=[x for x in names if x in exercise]
    for i,grp in enumerate(grouped(sports,2)):
        ts=['{'+x+'}' for x in grp]; e=' and '.join(lower_label(names[x]) for x in grp)
        if i%3==0:w.add('{我}{周末}{喜欢}'+('{和}'.join(ts))+'。',f'On weekends, I enjoy {e}.','habit and preference',deck['id'])
        elif i%3==1:w.add('{你}{想}{试试}'+('{还是}'.join(ts))+'？',f'Would you like to try {" or ".join(lower_label(names[x]) for x in grp)}?','alternatives in a question',deck['id'])
        else:w.add('{我们}{可以}{一起}'+('{和}'.join(ts))+'。',f'We can do {e} together.','modal 可以 and companionship',deck['id'])
    # Remaining words are exercise terms, outcomes and objects. Prefer naming
    # them directly as a topic of a coach's instructions, not a forced verb.
    leftovers=[c for c in deck['cards'] if c['hanzi'] not in exercise]
    equip={'哑铃','杠铃','跑步机','弹力带'}
    for c in leftovers:
        x=c['hanzi'];label=lower_label(c)
        if x in equip:w.add('{我}{今天}{要}{用}{'+x+'}{训练}。',f'I am going to train using {label} today.','equipment with 用',deck['id'])
        elif x=='健身房':w.add('{我}{今天}{想}{去}{健身房}{训练}。','I want to train at the gym today.','activity location',deck['id'])
        elif x in {'吉他','钢琴','乐器'}:
            w.add('{他}{每天}{都}{练习}{'+x+'}。',f'He practices {label} every day.','music practice and frequency',deck['id'])
        elif x in {'教练','队友'}:w.add('{我}{想}{跟}{'+x+'}{一起}{练习}。',f'I want to practice with my {label}.','comitative 跟',deck['id'])
        elif x in {'比赛','报名','预约'}:w.add('{我}{想}{'+x+'}。',f'I want to {label}.','activity intention',deck['id'])
        else:w.add('{我们}{需要}{了解}{'+x+'}{的}{作用}。',f'We need to understand the role of {label}.','nominalized technical topic',deck['id'])


def add_anatomy(w,deck):
    # Explicit boundaries keep injuries and actions out of body-part sentences.
    pains={'酸痛','疼','痛','受伤','拉伤','扭伤','肿','抽筋','僵硬','疲劳'}
    remedies={'康复','按摩','冰敷','热敷','护腕','护膝'}
    functions={'握力'}
    cards=[c for c in deck['cards'] if c['hanzi'] not in pains|remedies|functions]
    for i,grp in enumerate(grouped(cards,2)):
        eng=' and '.join(lower_label(c) for c in grp)
        w.add('{我们}{今天}{学习}{'+grp[0]['hanzi']+'}'+('{和}{'+grp[1]['hanzi']+'}' if len(grp)>1 else '')+'{的}{结构}。',
              f'Today we are learning about the structure of the {eng}.','anatomy and physiology',deck['id'])
    for c in deck['cards']:
        x=c['hanzi']; eng=lower_label(c)
        if x in pains:
            if x in {'受伤','拉伤','扭伤'}:
                w.add('{运动}{的}{时候}{要}{注意}，{不要}{'+x+'}。',f'Be careful when exercising to avoid a {eng}.','prevention and negative imperative',deck['id'])
            elif x in {'疼','痛','酸痛','肿','抽筋','僵硬','疲劳'}:
                w.add('{我}{运动}{之后}{觉得}{很}{'+x+'}。',f'After exercising, I experienced {eng}.','physical sensation after exercise',deck['id'])
        elif x in remedies:
            if x in {'护腕','护膝'}:
                w.add('{运动}{之前}{我}{会}{戴}{'+x+'}。',f'I wear a {eng} before training.','equipment used before exercise',deck['id'])
            elif x=='康复':
                w.add('{医生}{建议}{我}{进行}{康复}{训练}。','The doctor recommended rehabilitation exercises.','professional advice and rehabilitation',deck['id'])
            else:
                w.add('{医生}{建议}{我}{试试}{'+x+'}。',f'The doctor suggested I try {eng}.','advice and remedy',deck['id'])
        elif x in functions:
            w.add('{攀岩}{需要}{很}{好}{的}{'+x+'}。','Climbing requires good grip strength.','equipment-free physical requirement',deck['id'])


def add_climbing(w,deck):
    words={c['hanzi']:c for c in deck['cards']}
    gear={'攀岩鞋','镁粉','粉袋','刷子','指力板','抱石垫','安全带','头盔','动力绳','保护器','快挂','主锁','挂片','扁带'}
    move={'攀岩','抱石','定线','完攀','尝试','保护','顶绳','先锋攀登','挂绳','收绳','放绳','下降','踩点','换脚','换手','并手','发力','蹬','拉','推','抓','捏','勾','锁定','横移','检查','系紧'}
    neg={'坠落','脱落','落地'}
    g=[x for x in words if x in gear]
    for grp in grouped(g,2):
        tokens='{和}'.join('{'+x+'}' for x in grp)
        eng=' and '.join(lower_label(words[x]) for x in grp)
        w.add('{我}{出门}{之前}{需要}{检查}'+tokens+'。',f'Before heading out I need to check {eng}.','equipment safety and preparation',deck['id'])
    g=[x for x in words if x in move]
    for i,grp in enumerate(grouped(g,2)):
        tokens='{和}'.join('{'+x+'}' for x in grp)
        eng=' and '.join(lower_label(words[x]) for x in grp)
        if i%2==0:w.add('{我们}{今天}{学习}'+tokens+'{的}{技术}。',f'Today we are learning techniques for {eng}.','technique as study topic',deck['id'])
        else:w.add('{教练}{要}{我们}{练习}'+tokens+'。',f'The coach wants us to practice {eng}.','causative instruction',deck['id'])
    for c in deck['cards']:
        x=c['hanzi'];eng=lower_label(c)
        if x in gear|move:continue
        if x in neg:w.add('{攀岩}{的}{时候}{要}{注意}{'+x+'}。',f'When climbing, pay attention to {eng}.','risk awareness',deck['id'])
        elif x in {'加油','稳住','下来','休息一下'}:w.add('{教练}{说}：“{'+x+'}！”',f'The coach says, “{eng}!”','climbing encouragement',deck['id'])
        else:w.add('{我们}{先}{了解}{'+x+'}{的}{意思}。',f'First, we learn what {eng} means.','technical climbing terminology',deck['id'])


def add_slang(w,deck):
    expressions={
      '阳了':('{我}{朋友}{最近}{阳了}，{所以}{在}{家}{休息}。','My friend recently tested positive for COVID, so they are resting at home.'),
      '留守儿童':('{留守儿童}{需要}{更多}{关注}{和}{帮助}。','Left-behind children need more attention and support.'),
      '爬墙':('{他们}{周末}{去}{攀岩馆}{爬墙}。','They go to the climbing gym to climb walls on weekends.'),
      '不像话':('{这}{也}{太}{不像话}{了}！','This is completely out of line!'),
      '抓现行':('{我}{去}{攀岩馆}{查岗}，{结果}{把}{他}{抓现行}{了}。','I jokingly went to check up on him at the climbing gym and caught him in the act.'),
      '查岗':('{我}{去}{攀岩馆}{查岗}，{结果}{把}{他}{抓现行}{了}。','I jokingly went to check up on him at the climbing gym and caught him in the act.'),
      '吐槽':('{我们}{昨天}{一起}{吐槽}{了}{这个}{问题}。','We joked and complained about this problem together yesterday.'),
      '无语':('{今天}{又}{要}{加班}，{真}{无语}。','Overtime again today. I cannot even.'),
      '笑死':('{他}{的}{故事}{太}{好笑}{了}，{笑死}！','His story is so funny. I am dying laughing!'),
      '离谱':('{这个}{价格}{真}{离谱}。','This price is ridiculous.'),
      '绝了':('{这}{家}{餐厅}{的}{菜}{真}{绝了}！','The food at this restaurant is amazing!'),
      '好家伙':('{好家伙}，{他}{竟然}{一天}{爬}{了}{这么多}{线}！','Wow, he climbed so many routes in one day!'),
      '上头':('{这}{个}{游戏}{太}{上头}{了}。','This game is so addictive.'),
      '下头':('{他}{这样}{说话}{真}{下头}。','The way he talks is such a turn-off.'),
      '种草':('{朋友}{给}{我}{种草}{了}{一}{家}{餐厅}。','A friend made me want to try a particular restaurant.'),
      '拔草':('{我}{终于}{去}{拔草}{那}{家}{餐厅}{了}。','I finally tried that restaurant I had been eyeing.'),
      '避雷':('{这}{家}{店}{不}{太}{好}，{大家}{注意}{避雷}。','This shop is not great; everyone should avoid it.'),
      '踩雷':('{我们}{今天}{点菜}{踩雷}{了}。','We made a bad choice when ordering today.'),
      '摸鱼':('{他}{在}{办公室}{偷偷}{摸鱼}。','He is secretly slacking off at the office.'),
      '内卷':('{这}{个}{行业}{越来越}{内卷}{了}。','This industry is becoming more and more of a rat race.'),
      '躺平':('{周末}{我}{只}{想}{躺平}。','I just want to lie flat and take it easy this weekend.'),
      '摆烂':('{虽然}{很}{难}，{但是}{我}{不}{想}{摆烂}。','Although it is hard, I do not want to give up.'),
      '破防':('{看}{到}{这个}{消息}，{我}{直接}{破防}{了}。','That news got to me emotionally.'),
      '社死':('{我}{叫错}{了}{名字}，{真}{社死}。','I said the wrong name. So embarrassing!'),
      '吃瓜':('{我}{不}{参加}{讨论}，{只}{想}{吃瓜}。','I am not joining the discussion; I just want to watch the drama.'),
      '搭子':('{我}{想}{找}{个}{攀岩}{搭子}。','I want to find a climbing buddy.'),
      '饭搭子':('{我们}{经常}{一起}{吃饭}，{是}{饭搭子}。','We eat together often; we are food buddies.'),
      '搭伙':('{我们}{周末}{搭伙}{做饭}。','We are teaming up to cook over the weekend.'),
      '放鸽子':('{他}{又}{放鸽子}{了}，{我}{等}{了}{很久}。','He stood me up again. I waited a long time.'),
      '被鸽了':('{今天}{我}{被鸽了}，{只好}{自己}{去}。','I got stood up today, so I had to go alone.'),
      '翻车':('{这个}{计划}{今天}{翻车}{了}。','This plan went wrong today.'),
      '拿捏':('{这}{条}{线路}{他}{已经}{拿捏}{了}。','He has already mastered this climbing route.'),
      '硬控':('{这}{部}{电影}{把}{我}{硬控}{了}{两}{小时}。','This movie completely captivated me for two hours.'),
      '显眼包':('{他}{在}{朋友}{中}{是}{个}{显眼包}。','He is the goofy one who always attracts attention among his friends.'),
      '社恐':('{我}{有点}{社恐}，{不}{太}{喜欢}{人}{多}{的}{地方}。','I am a bit socially anxious and dislike crowded places.'),
      '社牛':('{他}{是}{社牛}，{跟}{谁}{都}{能}{聊天}。','He is extremely outgoing and can chat with anyone.'),
      '情绪价值':('{她}{很}{会}{提供}{情绪价值}。','She is good at offering emotional support and validation.'),
      '松弛感':('{这}{家}{咖啡馆}{很}{有}{松弛感}。','This café has a laid-back vibe.'),
      '班味':('{周末}{出来}{玩}，{先}{去}{去}{班味}。','Going out this weekend should shake off the office-worker vibe.'),
      '打工人':('{我们}{打工人}{周末}{终于}{可以}{休息}{了}。','We wage workers can finally rest over the weekend.'),
      '好磕':('{这}{两}{个}{人}{真}{好磕}。','These two have such shippable chemistry.'),
      '磕到了':('{看}{了}{这}{个}{视频}，{我}{磕到了}。','After watching this video, I am shipping them.'),
      '直球':('{他}{说话}{很}{直球}。','He speaks in a very direct, straightforward way.'),
      '有梗':('{这}{个}{朋友}{很}{有梗}。','This friend is really witty.'),
      '没梗':('{今天}{我}{有点}{没梗}。','I am a bit out of jokes today.'),
      '整活':('{他们}{周末}{又}{在}{整活}。','They are doing another goofy stunt this weekend.'),
      '笑不活了':('{看}{到}{这}{个}{视频}，{我}{笑不活了}。','That video is killing me with laughter.'),
      '人麻了':('{今天}{开会}{开}{了}{一天}，{人麻了}。','Meetings all day today. I am completely done.'),
      '真香':('{我}{以前}{不}{喜欢}{这}{个}{菜}，{现在}{真香}。','I used to dislike this dish, but I have changed my mind and love it.'),
      '打卡':('{我们}{周末}{去}{新}{店}{打卡}。','Let us check out that new shop this weekend.'),
      '约饭':('{下周}{有}{时间}{吗}？{一起}{约饭}{吧}。','Got time next week? Let us arrange a meal.'),
      '拼单':('{我们}{可以}{一起}{拼单}，{更}{便宜}。','We can combine our orders; it will be cheaper.'),
      '团购':('{这}{家}{餐厅}{有}{团购}，{很}{划算}。','This restaurant has a group-buy deal; it is good value.'),
      '安利':('{我}{想}{安利}{你}{这}{家}{店}。','I want to enthusiastically recommend this shop to you.'),
      '剧透':('{你}{千万}{不要}{剧透}！','Please do not spoil the plot!'),
      '弹幕':('{这}{个}{视频}{的}{弹幕}{很}{有意思}。','The live scrolling comments on this video are funny.'),
      '围观':('{大家}{都}{在}{围观}{这}{件}{事}。','Everyone is watching this unfold.'),
      '吃货':('{我}{是}{吃货}，{喜欢}{尝尝}{新}{的}{菜}。','I am a foodie and like trying new dishes.'),
    }
    for c in deck['cards']:
        s=expressions.get(c['hanzi']);
        if not s:raise ValueError('Missing curated slang example for '+c['hanzi'])
        w.add(s[0],s[1],'natural conversational register',deck['id'])


def generate(master,decks):
    w=Writer(master)
    with (ROOT/'content/grammar-seeds-031.tsv').open() as file:
        for row in csv.DictReader(file,delimiter='\t'):
            w.add(row['markup'],row['english'],row['principle'],'grammar-principles')
    placegroups={'visited-places','us-states','eu-capitals','asia-world-capitals','major-cities','china-regions','cities','countries'}
    for d in decks:
        id=d['id']
        if id in placegroups:add_many_places(w,d)
        elif id in {'china-meals','global-food','ingredients'}:add_food(w,d,id)
        elif id=='ordering':add_ordering(w,d)
        elif id=='activities':add_activity(w,d)
        elif id=='anatomy':add_anatomy(w,d)
        elif id=='climbing':add_climbing(w,d)
        elif id in {'slang-friends','slang-modern'}:add_slang(w,d)
    with (ROOT/'content/lexical-examples-031.tsv').open() as file:
        for row in csv.DictReader(file,delimiter='\t'):
            w.add(row['markup'],row['english'],row['principle'],'grammar-principles')
    fill_core_and_hsk(w,decks)
    fill_common_lexicon(w,decks)
    return w

# Editorially classified words that use the same syntactic frame naturally.
# Classes are intentionally explicit rather than guessed from dictionary glosses.
ACADEMIC_NOUNS=set('''问题 事情 事 原因 方法 方式 机会 生活 工作 学习 学校 大学 活动 信息 中心 行动 行为 家庭 服务 公司 影响 项目 安全 目标 任务 计划 信 关系 世界 情况 意见 能力 证明 交易 社会 发展 历史 政府 系统 研究 法律 传统 政治 空间 身份 数据 产品 申请 战争 机构 心理 梦 梦想 生命 意义 目标 责任 自然 人生 幸福 经验 规则 规定 知识 技术 技能 水平 数量 质量 竞争 速度 重量 力量 时间 事情 结果 方面 内容 报告 调查 合作 未来 文化 价格 作用 设计 比赛 选择 旅游 家庭 婚姻 教育 环境 交通 管理 记录 资料 组织 意义 任务 目标 位置 关系 经验 理由 状态 信息 办法 部分 内容 战争 事情 资料 历史 方法 交易 进度 合同 房租 工资 收据 发票 物业 房东 押金 网络 密码 信号 家人 生日 身份 申请 情绪价值 松弛感 班味 内卷 柔韧性 耐力 爆发力 协调 运动 生命 健康 科学 政治 想法 动作 方向 表现 人性 本质 存在 经历 传统 习惯 愿望 梦想 目标 社会 规则 项目 责任'''.split())
PHYSICAL_NOUNS=set('''手 眼 脸 口 心 身体 身上 衣服 床 电视 电影 歌 球 汽车 电话 票 字 相机 书 电脑 手机 信 眼镜 钥匙 图片 照片 眼 泪 房子 酒店 礼物 蛋糕 学生 老师 医生 记者 律师 朋友 同事 老板 男人 女人 女孩 男孩 兄弟 儿子 女儿 妈 爸爸 妈妈 狗 动物 车 站 车站 家里 包 装 产品 卡 牌 机器 系统 工具 文件 电脑 书包 窗户 桌子 椅子 门 纸 衣服 鞋子 袋子 杯子 盘 子 资料 书籍 材料 光 金 轮 根 盘 球 头发 手术 医院 工厂 机构 花 建筑 电视 房间 商店 店铺 邮件 袋子 香水 名字 家乡 出口 入口 衣服 行李 房子 照片 视频 礼物 盒子 衣柜 床头 电脑 护照 身份证 银行卡 充电宝 充电器 二维码 垃圾桶 电梯 楼梯 空调 冰箱 洗衣机 玻璃 标志 广告 牌子 字母 颜色 名字 项目'''.split())
PEOPLE=set('''学生 老师 医生 记者 律师 教授 总统 男人 女人 男孩 女孩 孩子 宝贝 兄弟 人们 人员 记者 客人 先生 同事 老板 朋友 经理 专家 工人 老人'''.split())
ADJECTIVE_MOOD=set('''高兴 难过 生气 担心 害怕 饿 渴 困 累 忙 开心 快乐 幸福 紧张 失望 兴奋 感动 伤心 满意 放松 不错 轻松 冷 热 舒服'''.split())
ADJECTIVE_NOUN=set('''大 小 高 低 长 短 旧 新 快 慢 远 近 满 宽 窄 软 硬 甜 咸 酸 苦 辣 熟 生 重要 严重 简单 复杂 巨大 免费 便宜 贵 轻松 安全 稳定 容易 难 明显 高兴 难过 特别 精彩 传统 突然 直接 正常 不同 完全 实用'''.split())
STANDALONE_VERBS=set('''出 出去 进 进去 回 回家 回来 走 跑 飞 动 来到 离开 进入 停下 睡 醒 睡觉 休息 工作 学习 运动 努力 合作 成功 结束 开始 继续 发展 变 拍 试 报名 参加 出生 死 活 赢 跳 走路 发烧 停 跑步 游泳 见面 迟到 吃饭 做饭 上班 下班 开会 旅行 登山 发脾气 坚持 受伤 抽筋 失败 进步 讲话 谈话 说话 生活 训练 增长 增加 减少 起床 发展 出现 发生 改变 变化 震动 休学 重返'''.split())
THOUGHT_VERBS=set('''了解 理解 研究 考虑 处理 解决 调查 讨论 解释 确认 证明 分析 比较 注意 发现 寻找 找到 想到 计划 设计 改变 影响 认识 意识 认同 看待 评价 使用 选择 选 认识 知道 报告 描述 介绍 接受 承认 允许 支持 判断 考察 审核 记录 记录 调查 建议 发现 想象 学习 查看 检查 反思 关注 评价 处理 认识 研究 观察 核对 处理 处理'''.split())
PEOPLE_VERBS=set('''爱 感谢 帮助 支持 理解 相信 认识 介绍 遇到 见到 看到 看见 听到 联系 陪 同情 关心 喜欢 想念 尊重 尊敬 邀请 保护 伤害 抱 亲 责怪 告诉'''.split())
OBJECT_VERBS=set('''买 卖 用 使用 拿 放 选 选择 送 找 寻找 找到 收 接 投 拍 抽 翻 挂 装 看 看到 看见 拍照 带 试 测试 烧 记 记得 读 写 画 包 修 设计 检查 更换 换 清理 打扫 寄 保存 收藏 丢 扔 喝 吃 戴 穿 按 指 推 拍 打 开 关 关闭 打开 印 申请 交易 获取 获得 失去 接受 持有 保护'''.split())
DEGREE_ADVERBS=set('''非常 特别 比较 总是 一直 也许 可能 似乎 真的 确实 当然 甚至 或许'''.split())


def add_standard_context(w,word,deck_id):
    c=w.master[word];en=lower_label(c)
    if word in PEOPLE:
        w.add('{我}{昨天}{见}{到}{一}{位}{'+word+'}。',f'Yesterday I met a {en}.','person with polite classifier 位',deck_id)
    elif word in ADJECTIVE_MOOD:
        w.add('{他}{今天}{觉得}{很}{'+word+'}。',f'He feels {en} today.','stative adjective as predicate',deck_id)
    elif word in ADJECTIVE_NOUN:
        w.add('{这}{个}{东西}{比较}{'+word+'}。',f'This item is relatively {en}.','stative comparison 比较',deck_id)
    elif word in THOUGHT_VERBS:
        method_words={'使用','选择','选','学习','认识','介绍','接受','建议','支持','允许','设计','记录','影响','观察'}
        if word in method_words:
            w.add('{我们}{需要}{了解}{'+word+'}{的}{用法}。',f'We need to learn how to use {en}.','transitive word in a usage explanation',deck_id)
        else:
            w.add('{我们}{需要}{'+word+'}{这}{个}{问题}。',f'We need to {en} this problem.','mental or discussion verb with object',deck_id)
    elif word in PEOPLE_VERBS:
        w.add('{我}{想}{'+word+'}{他}。',f'I want to {en} him.','transitive verb with person',deck_id)
    elif word in OBJECT_VERBS:
        w.add('{我}{今天}{想}{'+word+'}{这}{个}{东西}。',f'Today I want to {en} this item.','transitive verb with concrete object',deck_id)
    elif word in STANDALONE_VERBS:
        # The previous unrestricted 他+verb+了 frame incorrectly accepted
        # intransitives requiring a destination, object or contextual subject.
        selfcontained={'出去','回家','回来','睡觉','休息','工作','运动','成功','发烧','跑步','游泳','见面','迟到','吃饭','做饭','上班','下班','开会','旅行','登山','发脾气','受伤','抽筋','失败','进步','说话','训练','起床'}
        if word in selfcontained:
            w.add('{他}{今天}{'+word+'}{了}。',f'Today he did the following: {en}.','completed action with 了',deck_id)
        else:
            w.add('{我们}{今天}{学习}{'+word+'}{的}{用法}。',f'Today we are learning how to use {en}.','word usage in context',deck_id)
    elif word in DEGREE_ADVERBS:
        w.add('{他}{'+word+'}{喜欢}{这}{个}{地方}。',f'He likes this place ({en}).','adverb before predicate',deck_id)
    elif word in ACADEMIC_NOUNS:
        w.add('{我们}{正在}{讨论}{'+word+'}。',f'We are discussing {en}.','topic as object of 讨论',deck_id)
    elif word in PHYSICAL_NOUNS:
        w.add('{我}{昨天}{看到}{了}{'+word+'}。',f'I saw {en} yesterday.','concrete object of perception verb',deck_id)
    else:return False
    return True


def fill_core_and_hsk(w,decks):
    # First pass: explicit grammatical/semantic classes only. Unclassified
    # entries must receive a hand-reviewed override; no metalinguistic fallback.
    for d in decks:
        if d['id'] not in {'daily','everyday-core','grammar-support','hsk-2021-1','hsk-2021-2','hsk-2021-3','hsk-2021-4'}:continue
        for c in d['cards']:
            if c['hanzi'] in w.coverage():continue
            add_standard_context(w,c['hanzi'],d['id'])

FAMILY=set('''家人 父母 哥哥 姐姐 弟弟 妹妹 丈夫 妻子 孩子 儿子 女儿 妈妈 爸爸 先生 老婆 兄弟'''.split())
PRONOUNS=set('''您 你们 她们 他们 它们'''.split())
NUMBERS=set('''零 一 二 三 四 五 六 七 八 九 十 百 千 万 两 半'''.split())
WEEKDAYS=set('''星期一 星期二 星期三 星期四 星期五 星期六 星期天 星期日'''.split())
TIMEWORDS=set('''早上 上午 中午 下午 晚上 前天 昨天 今天 明天 后天 今年 去年 明年 平时 刚才 马上'''.split())
SIDEWORDS=set('''左边 右边 前面 后面 上面 下面 里面 外面 楼上 楼下 对面 旁边'''.split())
DIRECTIONS=set('''东 南 西 北'''.split())
COLORS=set('''红色 蓝色 绿色 黄色 黑色 白色 灰色 紫色'''.split())
SHOPPLACES=set('''便利店 菜市场 药店 洗手间 火车站 机场 小区 银行 医院 车站 超市 餐厅 图书馆 地铁站'''.split())
TRANSIT=set('''地铁 公交车 出租车 网约车 自行车 电动车 高铁 汽车'''.split())
DOCUMENTS=set('''护照 签证 身份证 发票 收据 车票 票 银行卡 合同 文件 地址'''.split())
CONCRETEITEMS=set('''手机 电脑 充电器 充电宝 热水 雨伞 裤子 袜子 快递 垃圾 垃圾桶 红绿灯 路口 眼睛 布 眼 帽子 皮鞋 书包 行李 盒子 照片 电影 书 电脑 网络 密码 充电宝'''.split())
DAILY_ACTIONS=set('''请假 回复 发邮件 充电 收款 转账 取件 租房 维修 换乘 排队 打车 洗澡 刷牙 洗碗 打折 退货 换货 试穿 直走 左转 右转 游泳 说话'''.split())

def fill_common_lexicon(w,decks):
    for d in decks:
        if d['id'] not in {'daily','everyday-core','grammar-support','hsk-2021-1','hsk-2021-2','hsk-2021-3','hsk-2021-4'}:continue
        for c in d['cards']:
            x=c['hanzi']
            if x in w.coverage():continue
            en=lower_label(c)
            if x in FAMILY:
                w.add('{我}{想}{和}{'+x+'}{一起}{吃饭}。',f'I would like to eat with my {en}.','family member as companion',d['id'])
            elif x in PRONOUNS:
                w.add('{'+x+'}{今天}{有}{时间}{吗}？',f'Do {en} have time today?','pronoun as question subject',d['id'])
            elif x=='它':w.add('{它}{在}{这里}。','It is here.','third-person animal or object pronoun',d['id'])
            elif x in NUMBERS:
                w.add('{这}{个}{东西}{要}{'+x+'}{元}。',f'This item costs {en} yuan.','number before currency',d['id'])
            elif x in WEEKDAYS:
                w.add('{我们}{'+x+'}{去}{散步}。',f'We are taking a walk on {en}.','time expression before predicate',d['id'])
            elif x in TIMEWORDS:
                w.add('{我}{'+x+'}{去}{工作}。',f'I go to work {en}.','time expression before verb',d['id'])
            elif x in SIDEWORDS:
                w.add('{那个}{地方}{在}{'+x+'}。',f'That place is {en}.','locative expression',d['id'])
            elif x in DIRECTIONS:
                w.add('{我们}{向}{'+x+'}{走}。',f'We walk toward the {en}.','directional preposition 向',d['id'])
            elif x in COLORS:
                w.add('{我}{喜欢}{'+x+'}{的}{衣服}。',f'I like {en} clothing.','color modifier with 的',d['id'])
            elif x in SHOPPLACES:
                w.add('{我们}{想}{去}{'+x+'}。',f'We would like to go to the {en}.','place as directional object',d['id'])
            elif x in TRANSIT:
                w.add('{我}{坐}{'+x+'}{去}{上海}。',f'I take {en} to Shanghai.','travel using transport mode',d['id'])
            elif x in DOCUMENTS:
                if x in {'地址','合同','收据','发票'}:
                    w.add('{请}{保存}{'+x+'}。',f'Please keep the {en}.','imperative with document',d['id'])
                else:
                    w.add('{出门}{之前}{请}{带}{'+x+'}。',f'Please bring your {en} before leaving.','imperative with time clause',d['id'])
            elif x in CONCRETEITEMS:
                w.add('{我}{今天}{想}{买}{'+x+'}。',f'I want to buy {en} today.','shopping intention',d['id'])
            elif x in DAILY_ACTIONS:
                if x=='打折':w.add('{这}{家}{店}{今天}{打折}。','This shop is having a sale today.','subject verb intransitive',d['id'])
                elif x in {'直走','左转','右转'}:w.add('{请}{先}{'+x+'}。',f'Please {en} first.','directional instruction',d['id'])
                else:w.add('{我}{今天}{要}{'+x+'}。',f'I need to {en} today.','future intention modal 要',d['id'])
            elif x in {'晴天','阴天'}:w.add('{今天}{是}{'+x+'}。',f'Today is a {en}.','weather description',d['id'])
            elif x in {'温度','湿度'}:w.add('{今天}{的}{'+x+'}{很}{高}。',f'The {en} is high today.','weather stative adjective',d['id'])
            elif x in {'年','月','日','号','天','星期','分钟','秒','小时'}:
                w.add('{我}{想}{了解}{'+x+'}{的}{用法}。',f'I want to understand how {en} is used.','time unit terminology',d['id'])
